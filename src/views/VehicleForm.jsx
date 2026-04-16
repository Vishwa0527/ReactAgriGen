import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK, nameOf } from '../data/mockData';
import { vehicleStore } from '../data/vehicleStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { depreciationStore } from '../data/depreciationStore';
import { fixedAssetHistoryStore } from '../data/fixedAssetHistoryStore';
import { GroupEstateFields } from '../components/GroupEstateFields';
import { Icon } from '../components/Icon';

const ID = 'vf';

/* ── Empty form state ── */
const EMPTY = {
  groupID: '', estateID: '',
  numbers: '', brand: '', model: '', capacity: '', registerYear: '', status: 'Active',
  vehicleTypeID: '', fixedAssetTypeID: '',
  fuelTypeID: '', secondaryFuelTypeID: '',
  costOfAsset: '', usefulLifeYears: '', residualValue: '', depreciationValue: '',
  fixedAssetID: '',
};

/* ── Validation ── */
function validate(form) {
  const e = {};
  if (!form.groupID)          e.groupID         = 'Group is required';
  if (!form.estateID)         e.estateID        = 'Estate is required';
  if (!form.numbers.trim())   e.numbers         = 'Registration number is required';
  if (!form.brand.trim())     e.brand           = 'Brand is required';
  if (!form.model.trim())     e.model           = 'Model is required';
  if (!form.vehicleTypeID)    e.vehicleTypeID   = 'Vehicle Type is required';
  if (!form.fixedAssetTypeID) e.fixedAssetTypeID = 'Fixed Asset Type is required';
  if (!form.fuelTypeID)       e.fuelTypeID      = 'Primary Fuel Type is required';
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

export default function VehicleForm() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isEdit   = Boolean(id);
  const existing = isEdit ? vehicleStore.getById(id) : null;

  /* ── Form state ── */
  const [form, setForm] = useState(() =>
    existing ? {
      groupID:             existing.groupID            ?? '',
      estateID:            existing.estateID           ?? '',
      numbers:             existing.numbers             ?? '',
      brand:               existing.brand              ?? '',
      model:               existing.model              ?? '',
      capacity:            existing.capacity           ?? '',
      registerYear:        existing.registerYear       ?? '',
      status:              existing.status             ?? 'Active',
      vehicleTypeID:       existing.vehicleTypeID      ?? '',
      fixedAssetTypeID:    existing.fixedAssetTypeID   ?? '',
      fuelTypeID:          existing.fuelTypeID         ?? '',
      secondaryFuelTypeID: existing.secondaryFuelTypeID ?? '',
      costOfAsset:         existing.costOfAsset        ?? '',
      usefulLifeYears:     existing.usefulLifeYears    ?? '',
      residualValue:       existing.residualValue      ?? '',
      depreciationValue:   existing.depreciationValue  ?? '',
      fixedAssetID:        existing.fixedAssetID       ?? '',
    } : EMPTY
  );
  const [errors, setErrors] = useState({});

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const handleSave = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      ...form,
      groupID:             Number(form.groupID)           || null,
      estateID:            Number(form.estateID)          || null,
      vehicleTypeID:       Number(form.vehicleTypeID)     || null,
      fixedAssetTypeID:    Number(form.fixedAssetTypeID)  || null,
      fuelTypeID:          Number(form.fuelTypeID)        || null,
      secondaryFuelTypeID: form.secondaryFuelTypeID ? Number(form.secondaryFuelTypeID) : null,
      fixedAssetID:        form.fixedAssetID ? Number(form.fixedAssetID) : null,
      costOfAsset:         parseFloat(form.costOfAsset)        || 0,
      usefulLifeYears:     parseFloat(form.usefulLifeYears)    || 0,
      residualValue:       parseFloat(form.residualValue)      || 0,
      depreciationValue:   parseFloat(form.depreciationValue)  || 0,
    };

    /* ── Auto-create Fixed Asset when cost is entered and no manual link ── */
    if (!isEdit && payload.costOfAsset > 0 && !payload.fixedAssetID) {
      const faCode     = fixedAssetStore.nextCode();
      const assetName  = `${payload.brand} ${payload.model} — ${payload.numbers}`;
      const today      = new Date().toISOString().slice(0, 10);
      const depValue   = depreciationStore.calculate(
        payload.costOfAsset, payload.residualValue, payload.usefulLifeYears
      );

      const newAssetId = fixedAssetStore.add({
        code:                 faCode,
        name:                 assetName,
        fixedAssetTypeID:     payload.fixedAssetTypeID,
        fixedAssetCategoryID: null,
        groupID:              payload.groupID,
        estateID:             payload.estateID,
        totalCostOfAsset:     payload.costOfAsset,
        implementationCost:   0,
        implementationDate:   today,
        startDate:            payload.registerYear || today,
        usefulLifeYears:      payload.usefulLifeYears,
        residualValue:        payload.residualValue,
        depreciationValue:    depValue,
        status:               'Active',
        isWarrantyEnabled:    false,
        warrantyStartDate:    null,
        warrantyEndDate:      null,
        ledgerTransactionRef: null,
      });

      /* Auto-create depreciation schedule if useful life is set */
      if (payload.usefulLifeYears > 0) {
        depreciationStore.add({
          fixedAssetID:      newAssetId,
          assetValue:        payload.costOfAsset,
          residualValue:     payload.residualValue,
          usefulYears:       payload.usefulLifeYears,
          depreciationValue: depValue,
          assetValueDate:    today,
          status:            'Active',
        });
      }

      /* Initial Registration snapshot in FA History */
      const newAsset = fixedAssetStore.getById(newAssetId);
      if (newAsset) fixedAssetHistoryStore.addSnapshot(newAsset, 'Initial Registration');

      payload.fixedAssetID = newAssetId;
      /* Keep form's depreciationValue in sync with auto-computed value */
      payload.depreciationValue = depValue;
    }

    if (isEdit) vehicleStore.update(id, payload);
    else        vehicleStore.add(payload);
    navigate('/vehicles');
  };

  const primaryFuels   = MOCK.fuelTypes.filter(f => !f.isSecondary);
  const secondaryFuels = MOCK.fuelTypes.filter(f => f.isSecondary);

  return (
    <div className="fade-up">

      {/* ── Page Title Bar ── */}
      <div className="page-title-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            id={`${ID}-btn-back`}
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/vehicles')}
            style={{ gap: 4 }}
          >
            <Icon name="chevron" style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} />
            Back
          </button>
          <div>
            <h1 className="page-title">
              {isEdit ? `Edit Vehicle — ${existing?.numbers}` : 'Add New Vehicle'}
            </h1>
            <p className="page-subtitle">
              {isEdit
                ? `${existing?.brand} ${existing?.model} · Update vehicle details`
                : 'Register a new vehicle to the fleet'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="card" style={{ maxWidth: 960 }}>
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

          {/* ── Section 2: Vehicle Information ── */}
          <section>
            <p className="section-label">Vehicle Information</p>
            <div className="form-grid form-grid-3">
              <Field label="Registration Numbers" required error={errors.numbers}>
                <input
                  id={`${ID}-input-numbers`}
                  className={`form-control${errors.numbers ? ' input-error' : ''}`}
                  value={form.numbers}
                  onChange={e => set('numbers', e.target.value.toUpperCase())}
                  placeholder="e.g. WP-CAB-2341"
                />
              </Field>

              <Field label="Brand" required error={errors.brand}>
                <input
                  id={`${ID}-input-brand`}
                  className={`form-control${errors.brand ? ' input-error' : ''}`}
                  value={form.brand}
                  onChange={e => set('brand', e.target.value)}
                  placeholder="e.g. Toyota"
                />
              </Field>

              <Field label="Model" required error={errors.model}>
                <input
                  id={`${ID}-input-model`}
                  className={`form-control${errors.model ? ' input-error' : ''}`}
                  value={form.model}
                  onChange={e => set('model', e.target.value)}
                  placeholder="e.g. Dyna"
                />
              </Field>

              <Field label="Capacity" hint="e.g. 3.5T, 200kg, 45 pax">
                <input
                  id={`${ID}-input-capacity`}
                  className="form-control"
                  value={form.capacity}
                  onChange={e => set('capacity', e.target.value)}
                  placeholder="e.g. 3.5T"
                />
              </Field>

              <Field label="Register Year">
                <input
                  id={`${ID}-input-register-year`}
                  className="form-control"
                  type="date"
                  value={form.registerYear}
                  onChange={e => set('registerYear', e.target.value)}
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
                  <option value="In Service">In Service</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 3: Classification ── */}
          <section>
            <p className="section-label">Classification</p>
            <div className="form-grid form-grid-2">
              <Field label="Vehicle Type" required error={errors.vehicleTypeID}>
                <select
                  id={`${ID}-select-vehicle-type`}
                  className={`form-control${errors.vehicleTypeID ? ' input-error' : ''}`}
                  value={form.vehicleTypeID}
                  onChange={e => set('vehicleTypeID', e.target.value)}
                >
                  <option value="">— Select Vehicle Type —</option>
                  {MOCK.vehicleTypes.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Fixed Asset Type" required error={errors.fixedAssetTypeID}>
                <select
                  id={`${ID}-select-fixed-asset-type`}
                  className={`form-control${errors.fixedAssetTypeID ? ' input-error' : ''}`}
                  value={form.fixedAssetTypeID}
                  onChange={e => set('fixedAssetTypeID', e.target.value)}
                >
                  <option value="">— Select Asset Type —</option>
                  {MOCK.fixedAssetTypes.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 3b: Fixed Asset Link ── */}
          <section>
            <p className="section-label">Fixed Asset Link</p>

            {/* Auto-link notice: shown on create when cost is entered and no manual link chosen */}
            {!isEdit && parseFloat(form.costOfAsset) > 0 && !form.fixedAssetID && (
              <div style={{
                marginBottom: 12, padding: '10px 14px',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-lighter, #bfdbfe)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: 'var(--primary-dark)',
              }}>
                <Icon name="link" style={{ width: 13, height: 13, flexShrink: 0 }} />
                A Fixed Asset record (<strong>{fixedAssetStore.nextCode()}</strong>) and depreciation schedule will be
                auto-created and linked when you save. To link an existing asset instead, select it below.
              </div>
            )}

            <div className="form-grid form-grid-2">
              <Field label="Linked Fixed Asset" hint="Optional — select an existing asset to link manually">
                <select
                  id={`${ID}-select-fixedAssetID`}
                  className="form-control"
                  value={form.fixedAssetID}
                  onChange={e => set('fixedAssetID', e.target.value)}
                >
                  <option value="">— None (not linked) —</option>
                  {fixedAssetStore.getAll().map(fa => (
                    <option key={fa.id} value={fa.id}>{fa.code} — {fa.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Read-only financial summary when linked */}
            {form.fixedAssetID && (() => {
              const fa = fixedAssetStore.getById(Number(form.fixedAssetID));
              if (!fa) return null;
              const dep = depreciationStore.getAll().find(d => d.fixedAssetID === fa.id);
              const bookValue = dep ? (dep.assetValue - (dep.depreciationValue * Math.min(
                Math.floor((Date.now() - new Date(dep.assetValueDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
                dep.usefulYears
              ))) : null;
              const fmtCur = v => `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
              return (
                <div style={{
                  marginTop: 12, padding: '14px 18px',
                  background: 'linear-gradient(135deg, var(--primary-light), #dbeafe)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-lighter, #bfdbfe)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Icon name="link" style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-dark)', letterSpacing: '0.02em' }}>
                      Linked Asset: {fa.code}
                    </span>
                    <span className={`badge ${fa.status === 'Active' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 9, marginLeft: 'auto' }}>
                      {fa.status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Total Cost</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtCur(fa.totalCostOfAsset)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Annual Dep.</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtCur(fa.depreciationValue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Est. Book Value</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{bookValue != null ? fmtCur(bookValue) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Warranty</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: fa.isWarrantyEnabled ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {fa.isWarrantyEnabled ? `Until ${fa.warrantyEndDate}` : 'None'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>

          <hr className="divider" />

          {/* ── Section 4: Fuel Configuration ── */}
          <section>
            <p className="section-label">Fuel Configuration</p>
            <div className="form-grid form-grid-2">
              <Field label="Primary Fuel Type" required error={errors.fuelTypeID}>
                <select
                  id={`${ID}-select-primary-fuel`}
                  className={`form-control${errors.fuelTypeID ? ' input-error' : ''}`}
                  value={form.fuelTypeID}
                  onChange={e => set('fuelTypeID', e.target.value)}
                >
                  <option value="">— Select Primary Fuel —</option>
                  {primaryFuels.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </Field>

              <Field label="Secondary Fuel Type" hint="Optional — for dual-fuel vehicles">
                <select
                  id={`${ID}-select-secondary-fuel`}
                  className="form-control"
                  value={form.secondaryFuelTypeID}
                  onChange={e => set('secondaryFuelTypeID', e.target.value)}
                >
                  <option value="">— None —</option>
                  {secondaryFuels.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 5: Financial & Depreciation ── */}
          <section>
            <p className="section-label">Financial & Depreciation</p>
            <div className="form-grid form-grid-4">
              <Field label="Cost of Asset (Rs.)" hint="Purchase / acquisition cost">
                <input
                  id={`${ID}-input-cost`}
                  className="form-control" type="number" min="0" step="0.01"
                  value={form.costOfAsset}
                  onChange={e => set('costOfAsset', e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Useful Life (Years)">
                <input
                  id={`${ID}-input-useful-life`}
                  className="form-control" type="number" min="0" step="0.5"
                  value={form.usefulLifeYears}
                  onChange={e => set('usefulLifeYears', e.target.value)}
                  placeholder="0"
                />
              </Field>

              <Field label="Residual Value (Rs.)" hint="Expected scrap / sale value">
                <input
                  id={`${ID}-input-residual-value`}
                  className="form-control" type="number" min="0" step="0.01"
                  value={form.residualValue}
                  onChange={e => set('residualValue', e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Depreciation Value (Rs.)" hint="Annual depreciation amount">
                <input
                  id={`${ID}-input-depreciation`}
                  className="form-control" type="number" min="0" step="0.01"
                  value={form.depreciationValue}
                  onChange={e => set('depreciationValue', e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>

            {(form.costOfAsset && form.usefulLifeYears && form.residualValue) && (
              <div style={{ marginTop:12, padding:'8px 14px', background:'var(--primary-light)', borderRadius:'var(--radius-sm)', fontSize:12, color:'var(--primary-dark)', display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="alert" style={{ width:14, height:14, flexShrink:0 }} />
                Straight-line depreciation estimate:{' '}
                <strong>
                  Rs.{' '}
                  {((parseFloat(form.costOfAsset) - parseFloat(form.residualValue)) / parseFloat(form.usefulLifeYears))
                    .toLocaleString('en-LK', { maximumFractionDigits: 2 })}
                  {' '}/ year
                </strong>
              </div>
            )}
          </section>

        </div>

        {/* ── Form Footer ── */}
        <div className="card-footer">
          <button id={`${ID}-btn-cancel`} className="btn btn-secondary" onClick={() => navigate('/vehicles')}>Cancel</button>
          <button id={`${ID}-btn-save`} className="btn btn-primary" onClick={handleSave}>
            <Icon name="check" />
            {isEdit ? 'Update Vehicle' : 'Save Vehicle'}
          </button>
        </div>
      </div>
    </div>
  );
}
