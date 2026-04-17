import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK } from '../data/mockData';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { fixedAssetTypeStore } from '../data/fixedAssetTypeStore';
import { fixedAssetCategoryStore } from '../data/fixedAssetCategoryStore';
import { fixedAssetHistoryStore } from '../data/fixedAssetHistoryStore';
import { GroupEstateFields } from '../components/GroupEstateFields';
import { GLEffectPanel }   from '../components/GLEffectPanel';
import { glEngine }        from '../utils/glEngine';
import { Icon } from '../components/Icon';

const ID = 'faf';

/* ── Empty form state ── */
const EMPTY = {
  groupID: '', estateID: '',
  code: '', name: '', registrationNumber: '', status: 'Active',
  fixedAssetTypeID: '', fixedAssetCategoryID: '',
  totalCostOfAsset: '', residualValue: '', implementationCost: '',
  implementationDate: '', startDate: '', usefulLifeYears: '', depreciationValue: '',
  isFuelNeeded: false, fuelTypeID: '',
  isWarrantyEnabled: false, warrantyStartDate: '', warrantyEndDate: '',
  ledgerTransactionRef: '',
};

/* ── Validation ── */
function validate(form, editingID) {
  const e = {};
  if (!form.groupID)           e.groupID           = 'Group is required';
  if (!form.estateID)          e.estateID          = 'Estate is required';
  if (!form.code.trim()) {
    e.code = 'Asset code is required';
  } else if (!fixedAssetStore.isCodeUnique(form.code.trim().toUpperCase(), editingID)) {
    e.code = 'This code is already in use';
  }
  if (!form.name.trim())            e.name             = 'Asset name is required';
  if (!form.fixedAssetTypeID)       e.fixedAssetTypeID = 'Asset type is required';
  if (!form.fixedAssetCategoryID)   e.fixedAssetCategoryID = 'Category is required';
  if (!form.startDate)              e.startDate        = 'Start date is required';
  const cost = parseFloat(form.totalCostOfAsset);
  if (!cost || cost <= 0)           e.totalCostOfAsset = 'Total cost must be greater than 0';
  const life = parseInt(form.usefulLifeYears);
  if (!life || life <= 0)           e.usefulLifeYears  = 'Useful life must be at least 1 year';
  return e;
}

/* ── Reusable field wrapper ── */
function Field({ label, required, error, hint, span, children }) {
  return (
    <div className="form-group" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label className="form-label">
        {label}{required && <span className="required"> *</span>}
      </label>
      {children}
      {error
        ? <span className="field-error">{error}</span>
        : hint && <span className="field-hint">{hint}</span>
      }
    </div>
  );
}

export default function FixedAssetForm() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isEdit   = Boolean(id);
  const existing = isEdit ? fixedAssetStore.getById(id) : null;

  const [assetTypes]      = useState(() => fixedAssetTypeStore.getAll());
  const [allCategories]   = useState(() => fixedAssetCategoryStore.getAll());

  /* ── Form state ── */
  const [form, setForm] = useState(() =>
    existing ? {
      groupID:              existing.groupID              ?? '',
      estateID:             existing.estateID             ?? '',
      code:                 existing.code                 ?? '',
      name:                 existing.name                 ?? '',
      registrationNumber:   existing.registrationNumber   ?? '',
      status:               existing.status               ?? 'Active',
      fixedAssetTypeID:     existing.fixedAssetTypeID     ?? '',
      fixedAssetCategoryID: existing.fixedAssetCategoryID ?? '',
      totalCostOfAsset:     existing.totalCostOfAsset     ?? '',
      residualValue:        existing.residualValue        ?? '',
      implementationCost:   existing.implementationCost   ?? '',
      implementationDate:   existing.implementationDate   ?? '',
      startDate:            existing.startDate            ?? '',
      usefulLifeYears:      existing.usefulLifeYears      ?? '',
      depreciationValue:    existing.depreciationValue    ?? '',
      isFuelNeeded:         existing.isFuelNeeded         ?? false,
      fuelTypeID:           existing.fuelTypeID           ?? '',
      isWarrantyEnabled:    existing.isWarrantyEnabled    ?? false,
      warrantyStartDate:    existing.warrantyStartDate    ?? '',
      warrantyEndDate:      existing.warrantyEndDate      ?? '',
      ledgerTransactionRef: existing.ledgerTransactionRef ?? '',
    } : { ...EMPTY, code: fixedAssetStore.nextCode() }
  );
  const [errors, setErrors] = useState({});

  /* ── GL workflow state (edit-mode only; tracks without blocking form edits) ── */
  const [glState, setGLState] = useState(() => ({
    GLApprovalStatus: existing?.GLApprovalStatus ?? 'Draft',
    GLPostingRef:     existing?.GLPostingRef     ?? null,
    GLRejectionNote:  existing?.GLRejectionNote  ?? null,
    IsPostedToGL:     existing?.IsPostedToGL     ?? false,
  }));

  /* ── Cascading categories ── */
  const filteredCategories = useMemo(() =>
    form.fixedAssetTypeID
      ? allCategories.filter(c => c.fixedAssetTypeID === Number(form.fixedAssetTypeID))
      : [],
    [allCategories, form.fixedAssetTypeID]
  );

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const primaryFuels   = MOCK.fuelTypes.filter(f => !f.isSecondary);

  /* ── Straight-line depreciation calc ── */
  const costVal     = parseFloat(form.totalCostOfAsset) || 0;
  const residualVal = parseFloat(form.residualValue) || 0;
  const lifeVal     = parseInt(form.usefulLifeYears) || 0;
  const calcDep     = lifeVal > 0 ? (costVal - residualVal) / lifeVal : 0;

  /* ── GL workflow callbacks (only wired in edit mode) ── */
  const glCallbacks = isEdit ? {
    onConfirm: () => {
      const updates = { GLApprovalStatus: 'PendingApproval' };
      fixedAssetStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
    onApprove: () => {
      const result = glEngine.post({
        transactionTypeCode:  'FA_CAPITALIZATION',
        transactionDate:      new Date().toISOString().slice(0, 10),
        sourceTableName:      'FixedAsset',
        sourceRecordID:       existing.id,
        amount:               parseFloat(form.totalCostOfAsset) || 0,
        fixedAssetTypeID:     Number(form.fixedAssetTypeID)     || null,
        fixedAssetCategoryID: Number(form.fixedAssetCategoryID) || null,
        description:          `Capitalization — ${form.name}`,
        groupID:              Number(form.groupID)  || null,
        estateID:             Number(form.estateID) || null,
        createdBy:            'System',
      });
      if (result.success) {
        const updates = {
          GLApprovalStatus: 'Approved',
          IsPostedToGL:     true,
          GLPostingRef:     result.documentReference,
          GLApprovedDate:   new Date().toISOString().slice(0, 10),
        };
        fixedAssetStore.update(id, updates);
        setGLState(s => ({ ...s, ...updates }));
      }
    },
    onReject: (note) => {
      const updates = { GLApprovalStatus: 'Rejected', GLRejectionNote: note };
      fixedAssetStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
    onResubmit: () => {
      const updates = { GLApprovalStatus: 'PendingApproval', GLRejectionNote: null };
      fixedAssetStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
  } : {};

  const handleSave = () => {
    const errs = validate(form, isEdit ? existing.id : null);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      ...form,
      code:                 form.code.trim().toUpperCase(),
      name:                 form.name.trim(),
      groupID:              Number(form.groupID)   || null,
      estateID:             Number(form.estateID)  || null,
      fixedAssetTypeID:     Number(form.fixedAssetTypeID)     || null,
      fixedAssetCategoryID: Number(form.fixedAssetCategoryID) || null,
      totalCostOfAsset:     parseFloat(form.totalCostOfAsset)  || 0,
      residualValue:        parseFloat(form.residualValue)     || 0,
      implementationCost:   parseFloat(form.implementationCost) || 0,
      usefulLifeYears:      parseInt(form.usefulLifeYears)     || 0,
      depreciationValue:    parseFloat(form.depreciationValue) || calcDep,
      fuelTypeID:           form.isFuelNeeded && form.fuelTypeID ? Number(form.fuelTypeID) : null,
      isFuelNeeded:         !!form.isFuelNeeded,
      isWarrantyEnabled:    !!form.isWarrantyEnabled,
      warrantyStartDate:    form.isWarrantyEnabled ? form.warrantyStartDate || null : null,
      warrantyEndDate:      form.isWarrantyEnabled ? form.warrantyEndDate || null : null,
      registrationNumber:   form.registrationNumber.trim() || null,
      ledgerTransactionRef: form.ledgerTransactionRef.trim() || null,
    };

    if (isEdit) {
      fixedAssetStore.update(id, payload);
    } else {
      const newId = fixedAssetStore.add(payload);
      // Auto-create initial history snapshot
      const asset = fixedAssetStore.getById(newId);
      if (asset) {
        fixedAssetHistoryStore.addSnapshot(asset, 'Initial Registration', {
          presentValue: asset.totalCostOfAsset,
        });
      }
    }
    navigate('/assets-register');
  };

  return (
    <div className="fade-up">

      {/* ── Page Title Bar ── */}
      <div className="page-title-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            id={`${ID}-btn-back`}
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/assets-register')}
            style={{ gap: 4 }}
          >
            <Icon name="chevron" style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} />
            Back
          </button>
          <div>
            <h1 className="page-title">
              {isEdit ? `Edit Asset — ${existing?.code}` : 'Register New Fixed Asset'}
            </h1>
            <p className="page-subtitle">
              {isEdit
                ? `${existing?.name} · Update asset details`
                : 'Add a new fixed asset to the register'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="card" style={{ maxWidth: 1020 }}>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── Section 1: Group & Estate ── */}
          <section>
            <p className="section-label">Group & Estate</p>
            <GroupEstateFields
              idPrefix={ID}
              groupID={form.groupID}
              estateID={form.estateID}
              onChange={set}
              errors={errors}
            />
          </section>

          <hr className="divider" />

          {/* ── Section 2: Asset Identity ── */}
          <section>
            <p className="section-label">Asset Identity</p>
            <div className="form-grid form-grid-3">
              <Field label="Asset Code" required error={errors.code}>
                <input
                  id={`${ID}-input-code`}
                  className={`form-control${errors.code ? ' input-error' : ''}`}
                  value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. FA-0008"
                  maxLength={20}
                />
              </Field>

              <Field label="Asset Name" required error={errors.name} span={2}>
                <input
                  id={`${ID}-input-name`}
                  className={`form-control${errors.name ? ' input-error' : ''}`}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Mahindra 575 DI Tractor"
                />
              </Field>

              <Field label="Registration / Serial No." hint="Vehicle plate or equipment serial">
                <input
                  id={`${ID}-input-registration`}
                  className="form-control"
                  value={form.registrationNumber}
                  onChange={e => set('registrationNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. WP-CAB-2341"
                />
              </Field>

              <Field label="Status">
                <select
                  id={`${ID}-select-status`}
                  className="form-control"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </Field>
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 3: Classification ── */}
          <section>
            <p className="section-label">Classification</p>
            <div className="form-grid form-grid-2">
              <Field label="Fixed Asset Type" required error={errors.fixedAssetTypeID}>
                <select
                  id={`${ID}-select-fixedAssetTypeID`}
                  className={`form-control${errors.fixedAssetTypeID ? ' input-error' : ''}`}
                  value={form.fixedAssetTypeID}
                  onChange={e => { set('fixedAssetTypeID', e.target.value); set('fixedAssetCategoryID', ''); }}
                >
                  <option value="">— Select Asset Type —</option>
                  {assetTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Asset Category" required error={errors.fixedAssetCategoryID}>
                <select
                  id={`${ID}-select-fixedAssetCategoryID`}
                  className={`form-control${errors.fixedAssetCategoryID ? ' input-error' : ''}`}
                  value={form.fixedAssetCategoryID}
                  onChange={e => set('fixedAssetCategoryID', e.target.value)}
                  disabled={!form.fixedAssetTypeID}
                >
                  <option value="">
                    {form.fixedAssetTypeID ? '— Select Category —' : '— Select Type first —'}
                  </option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 4: Financial ── */}
          <section>
            <p className="section-label">Financial & Depreciation</p>
            <div className="form-grid form-grid-4">
              <Field label="Total Cost of Asset (Rs.)" required error={errors.totalCostOfAsset} hint="Purchase / acquisition cost">
                <input
                  id={`${ID}-input-totalCost`}
                  className={`form-control${errors.totalCostOfAsset ? ' input-error' : ''}`}
                  type="number" min="0" step="0.01"
                  value={form.totalCostOfAsset}
                  onChange={e => set('totalCostOfAsset', e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Residual Value (Rs.)" hint="Expected scrap / sale value">
                <input
                  id={`${ID}-input-residualValue`}
                  className="form-control" type="number" min="0" step="0.01"
                  value={form.residualValue}
                  onChange={e => set('residualValue', e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Implementation Cost (Rs.)" hint="Installation / commissioning cost">
                <input
                  id={`${ID}-input-implCost`}
                  className="form-control" type="number" min="0" step="0.01"
                  value={form.implementationCost}
                  onChange={e => set('implementationCost', e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Useful Life (Years)" required error={errors.usefulLifeYears}>
                <input
                  id={`${ID}-input-usefulLife`}
                  className={`form-control${errors.usefulLifeYears ? ' input-error' : ''}`}
                  type="number" min="1" step="1"
                  value={form.usefulLifeYears}
                  onChange={e => set('usefulLifeYears', e.target.value)}
                  placeholder="e.g. 10"
                />
              </Field>
            </div>

            <div className="form-grid form-grid-3" style={{ marginTop: 16 }}>
              <Field label="Depreciation Value (Rs. / Year)" hint="Override or auto-calculated">
                <input
                  id={`${ID}-input-depValue`}
                  className="form-control" type="number" min="0" step="0.01"
                  value={form.depreciationValue}
                  onChange={e => set('depreciationValue', e.target.value)}
                  placeholder={calcDep > 0 ? calcDep.toFixed(2) : '0.00'}
                />
              </Field>

              <Field label="Implementation Date">
                <input
                  id={`${ID}-input-implDate`}
                  className="form-control" type="date"
                  value={form.implementationDate}
                  onChange={e => set('implementationDate', e.target.value)}
                />
              </Field>

              <Field label="Service Start Date" required error={errors.startDate}>
                <input
                  id={`${ID}-input-startDate`}
                  className={`form-control${errors.startDate ? ' input-error' : ''}`}
                  type="date"
                  value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                />
              </Field>
            </div>

            {/* Depreciation estimate hint */}
            {(costVal > 0 && lifeVal > 0) && (
              <div style={{
                marginTop: 12, padding: '8px 14px', background: 'var(--primary-light)',
                borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--primary-dark)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="alert" style={{ width: 14, height: 14, flexShrink: 0 }} />
                Straight-line depreciation estimate:{' '}
                <strong>
                  Rs. {calcDep.toLocaleString('en-LK', { maximumFractionDigits: 2 })} / year
                </strong>
                {residualVal > 0 && (
                  <span style={{ marginLeft: 8, opacity: 0.7 }}>
                    (after residual Rs. {residualVal.toLocaleString('en-LK')})
                  </span>
                )}
              </div>
            )}
          </section>

          <hr className="divider" />

          {/* ── Section 5: Fuel Configuration ── */}
          <section>
            <p className="section-label">Fuel Configuration</p>
            <div className="form-grid form-grid-2">
              <Field label="Fuel Required?">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      id={`${ID}-checkbox-fuelNeeded`}
                      type="checkbox"
                      checked={form.isFuelNeeded}
                      onChange={e => { set('isFuelNeeded', e.target.checked); if (!e.target.checked) set('fuelTypeID', ''); }}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                    />
                    This asset requires fuel
                  </label>
                </div>
              </Field>

              {form.isFuelNeeded && (
                <Field label="Fuel Type">
                  <select
                    id={`${ID}-select-fuelType`}
                    className="form-control"
                    value={form.fuelTypeID}
                    onChange={e => set('fuelTypeID', e.target.value)}
                  >
                    <option value="">— Select Fuel —</option>
                    {primaryFuels.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 6: Warranty ── */}
          <section>
            <p className="section-label">Warranty</p>
            <div className="form-grid form-grid-3">
              <Field label="Warranty Enabled?">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      id={`${ID}-checkbox-warranty`}
                      type="checkbox"
                      checked={form.isWarrantyEnabled}
                      onChange={e => {
                        set('isWarrantyEnabled', e.target.checked);
                        if (!e.target.checked) { set('warrantyStartDate', ''); set('warrantyEndDate', ''); }
                      }}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                    />
                    Warranty applies
                  </label>
                </div>
              </Field>

              {form.isWarrantyEnabled && (
                <>
                  <Field label="Warranty Start">
                    <input
                      id={`${ID}-input-warrantyStart`}
                      className="form-control" type="date"
                      value={form.warrantyStartDate}
                      onChange={e => set('warrantyStartDate', e.target.value)}
                    />
                  </Field>
                  <Field label="Warranty End">
                    <input
                      id={`${ID}-input-warrantyEnd`}
                      className="form-control" type="date"
                      value={form.warrantyEndDate}
                      onChange={e => set('warrantyEndDate', e.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 7: ERP Integration ── */}
          <section>
            <p className="section-label">ERP Integration</p>
            <div className="form-grid form-grid-2">
              <Field label="Ledger Transaction Reference" hint="AgriGEN ERP ledger reference code">
                <input
                  id={`${ID}-input-ledgerRef`}
                  className="form-control"
                  value={form.ledgerTransactionRef}
                  onChange={e => set('ledgerTransactionRef', e.target.value)}
                  placeholder="e.g. LT-2024-0150"
                />
              </Field>
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 8: GL Capitalization ── */}
          <section>
            <p className="section-label">GL Capitalization</p>
            {!isEdit && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Save this asset to begin the GL capitalization approval workflow.
              </p>
            )}
            <GLEffectPanel
              idPrefix={ID}
              transactionTypeCode="FA_CAPITALIZATION"
              fixedAssetTypeID={Number(form.fixedAssetTypeID) || null}
              fixedAssetCategoryID={Number(form.fixedAssetCategoryID) || null}
              amount={parseFloat(form.totalCostOfAsset) || 0}
              glApprovalStatus={glState.GLApprovalStatus}
              glPostingRef={glState.GLPostingRef}
              glRejectionNote={glState.GLRejectionNote}
              isPostedToGL={glState.IsPostedToGL}
              {...glCallbacks}
            />
          </section>

        </div>

        {/* ── Form Footer ── */}
        <div className="card-footer">
          <button id={`${ID}-btn-cancel`} className="btn btn-secondary" onClick={() => navigate('/assets-register')}>Cancel</button>
          <button id={`${ID}-btn-save`} className="btn btn-primary" onClick={handleSave}>
            <Icon name="check" />
            {isEdit ? 'Update Asset' : 'Register Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
