import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assetDisposalStore } from '../data/assetDisposalStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { depreciationStore } from '../data/depreciationStore';
import { depreciationHistoryStore } from '../data/depreciationHistoryStore';
import { GroupEstateFields } from '../components/GroupEstateFields';
import { GLEffectPanel } from '../components/GLEffectPanel';
import { Icon } from '../components/Icon';
import { glEngine } from '../utils/glEngine';

const ID = 'adf';

const DISPOSAL_TYPES = ['Sale', 'Write-Off', 'Donation', 'Scrap'];

const EMPTY = {
  groupID: '', estateID: '', fixedAssetID: '', disposalCode: '',
  disposalDate: '', disposalType: 'Sale', disposalReason: '',
  saleProceeds: '', bookValueAtDisposal: '', gainLossOnDisposal: '',
  approvedBy: '', notes: '', status: 'Draft',
};

function validate(form, editingID) {
  const e = {};
  if (!form.groupID)         e.groupID     = 'Group is required';
  if (!form.estateID)        e.estateID    = 'Estate is required';
  if (!form.fixedAssetID)    e.fixedAssetID = 'Asset is required';
  if (!form.disposalCode.trim()) {
    e.disposalCode = 'Code is required';
  } else if (!assetDisposalStore.isCodeUnique(form.disposalCode.trim().toUpperCase(), editingID)) {
    e.disposalCode = 'Code already in use';
  }
  if (!form.disposalDate)    e.disposalDate   = 'Date is required';
  if (!form.disposalType)    e.disposalType   = 'Type is required';
  if (!form.disposalReason.trim()) e.disposalReason = 'Reason is required';
  if (form.disposalType === 'Sale') {
    const sp = parseFloat(form.saleProceeds);
    if (isNaN(sp) || sp < 0) e.saleProceeds = 'Sale proceeds must be ≥ 0';
  }
  return e;
}

/** Straight-line book value as of a given date */
function computeBookValue(asset, asOfDate) {
  const schedule = depreciationStore.getByAssetId(asset.id)[0];
  if (!schedule) return asset.residualValue ?? 0;
  const startMs  = new Date(schedule.assetValueDate || asset.startDate).getTime();
  const asOfMs   = new Date(asOfDate || new Date()).getTime();
  const yearsElapsed = Math.max(0, (asOfMs - startMs) / (365.25 * 86400000));
  const bookValue = asset.totalCostOfAsset - schedule.depreciationValue * yearsElapsed;
  return Math.max(asset.residualValue ?? 0, Math.round(bookValue));
}

export default function AssetDisposalForm() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isEdit   = Boolean(id);
  const existing = isEdit ? assetDisposalStore.getById(id) : null;

  const [assets] = useState(() =>
    fixedAssetStore.getAll().filter(a => isEdit ? true : a.status !== 'Disposed')
  );

  const [form, setForm] = useState(() =>
    existing ? {
      groupID:             existing.groupID ?? '',
      estateID:            existing.estateID ?? '',
      fixedAssetID:        existing.fixedAssetID ?? '',
      disposalCode:        existing.disposalCode ?? '',
      disposalDate:        existing.disposalDate ?? '',
      disposalType:        existing.disposalType ?? 'Sale',
      disposalReason:      existing.disposalReason ?? '',
      saleProceeds:        existing.saleProceeds ?? '',
      bookValueAtDisposal: existing.bookValueAtDisposal ?? '',
      gainLossOnDisposal:  existing.gainLossOnDisposal ?? '',
      approvedBy:          existing.approvedBy ?? '',
      notes:               existing.notes ?? '',
      status:              existing.status ?? 'Draft',
    } : { ...EMPTY, disposalCode: assetDisposalStore.nextCode() }
  );

  const [errors, setErrors] = useState({});

  const [glState, setGLState] = useState(() => ({
    GLApprovalStatus: existing?.GLApprovalStatus ?? 'Draft',
    GLPostingRef:     existing?.GLPostingRef     ?? null,
    GLRejectionNote:  existing?.GLRejectionNote  ?? null,
    IsPostedToGL:     existing?.IsPostedToGL     ?? false,
  }));

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  /* Auto-fill when asset is selected */
  const handleAssetSelect = (assetID) => {
    set('fixedAssetID', assetID);
    if (!assetID) { set('bookValueAtDisposal', ''); set('gainLossOnDisposal', ''); return; }
    const a = assets.find(x => x.id === Number(assetID));
    if (!a) return;
    setForm(f => {
      const bv = computeBookValue(a, f.disposalDate || new Date().toISOString().slice(0, 10));
      const sp = parseFloat(f.saleProceeds) || 0;
      return {
        ...f,
        fixedAssetID:        assetID,
        groupID:             a.groupID  || f.groupID,
        estateID:            a.estateID || f.estateID,
        bookValueAtDisposal: bv,
        gainLossOnDisposal:  f.disposalType === 'Sale' ? sp - bv : '',
      };
    });
  };

  /* Recompute book value when date changes */
  const handleDateChange = (val) => {
    set('disposalDate', val);
    if (!form.fixedAssetID || !val) return;
    const a = assets.find(x => x.id === Number(form.fixedAssetID));
    if (!a) return;
    const bv = computeBookValue(a, val);
    const sp = parseFloat(form.saleProceeds) || 0;
    setForm(f => ({
      ...f,
      disposalDate:        val,
      bookValueAtDisposal: bv,
      gainLossOnDisposal:  f.disposalType === 'Sale' ? sp - bv : '',
    }));
  };

  /* Recompute gain/loss when sale proceeds change */
  const handleSaleProceedsChange = (val) => {
    set('saleProceeds', val);
    const sp = parseFloat(val) || 0;
    const bv = parseFloat(form.bookValueAtDisposal) || 0;
    set('gainLossOnDisposal', form.disposalType === 'Sale' ? sp - bv : '');
  };

  /* Recompute when type changes */
  const handleTypeChange = (val) => {
    set('disposalType', val);
    if (val !== 'Sale') {
      setForm(f => ({ ...f, disposalType: val, saleProceeds: '', gainLossOnDisposal: '' }));
    } else {
      const sp = parseFloat(form.saleProceeds) || 0;
      const bv = parseFloat(form.bookValueAtDisposal) || 0;
      setForm(f => ({ ...f, disposalType: val, gainLossOnDisposal: sp - bv }));
    }
  };

  /* Selected asset info for the read-only panel */
  const selectedAsset = useMemo(() =>
    form.fixedAssetID ? assets.find(a => a.id === Number(form.fixedAssetID)) : null,
    [form.fixedAssetID, assets]
  );

  /* Read-only once a disposal has been approved or completed */
  const isReadOnly = isEdit && existing?.status !== 'Draft';

  const disposalGL = useMemo(() => {
    if (!selectedAsset) return null;
    const purchaseCost   = Number(selectedAsset.totalCostOfAsset) || 0;
    const accumulatedDep = depreciationHistoryStore.totalPosted(selectedAsset.id);
    const saleProceeds   = form.disposalType === 'Sale' ? (parseFloat(form.saleProceeds) || 0) : 0;
    return glEngine.previewDisposal({
      purchaseCost,
      accumulatedDep,
      saleProceeds,
      fixedAssetTypeID:     selectedAsset.fixedAssetTypeID     ?? null,
      fixedAssetCategoryID: selectedAsset.fixedAssetCategoryID ?? null,
    });
  }, [selectedAsset, form.disposalType, form.saleProceeds]);

  const glCallbacks = isEdit ? {
    onConfirm: () => {
      const updates = { GLApprovalStatus: 'PendingApproval' };
      assetDisposalStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
    onApprove: () => {
      if (!disposalGL) return;
      const result = glEngine.post({
        transactionTypeCode:  disposalGL.transactionTypeCode,
        transactionDate:      form.disposalDate || new Date().toISOString().slice(0, 10),
        sourceTableName:      'AssetDisposal',
        sourceRecordID:       existing.id,
        amount:               0,
        fixedAssetTypeID:     selectedAsset?.fixedAssetTypeID     ?? null,
        fixedAssetCategoryID: selectedAsset?.fixedAssetCategoryID ?? null,
        amounts:              disposalGL.amounts,
        description:          `Disposal — ${existing?.disposalCode}`,
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
        assetDisposalStore.update(id, updates);
        setGLState(s => ({ ...s, ...updates }));
      }
    },
    onReject: (note) => {
      const updates = { GLApprovalStatus: 'Rejected', GLRejectionNote: note };
      assetDisposalStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
    onResubmit: () => {
      const updates = { GLApprovalStatus: 'PendingApproval', GLRejectionNote: null };
      assetDisposalStore.update(id, updates);
      setGLState(s => ({ ...s, ...updates }));
    },
  } : {};

  const handleSave = () => {
    if (isReadOnly) return;
    const errs = validate(form, isEdit ? existing.id : null);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const bv = parseFloat(form.bookValueAtDisposal) || 0;
    const sp = parseFloat(form.saleProceeds) || 0;

    const payload = {
      ...form,
      disposalCode:        form.disposalCode.trim().toUpperCase(),
      fixedAssetID:        Number(form.fixedAssetID),
      groupID:             Number(form.groupID),
      estateID:            Number(form.estateID),
      bookValueAtDisposal: bv,
      saleProceeds:        form.disposalType === 'Sale' ? sp : null,
      gainLossOnDisposal:  form.disposalType === 'Sale' ? sp - bv : null,
      // status is never set by the form — managed by workflow (approve / complete)
    };
    delete payload.status;

    if (isEdit) {
      assetDisposalStore.update(id, payload);
    } else {
      assetDisposalStore.add(payload);
    }
    navigate('/asset-disposal');
  };

  return (
    <div className="fade-up">
      {/* Page Title */}
      <div className="page-title-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            id={`${ID}-btn-back`}
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/asset-disposal')}
            style={{ gap: 4 }}
          >
            <Icon name="chevron" style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} /> Back
          </button>
          <div>
            <h1 className="page-title">
              {isEdit ? `Edit Disposal — ${existing?.disposalCode}` : 'Record Asset Disposal'}
            </h1>
            <p className="page-subtitle">
              {isEdit
                ? 'Update the disposal record'
                : 'Write off, sell, donate, or scrap a fixed asset'}
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 900 }}>

        {/* ── Read-only banner for Approved / Completed disposals ── */}
        {isReadOnly && (
          <div style={{
            margin: '16px 16px 0',
            padding: '12px 16px',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
          }}>
            <Icon name="alert" style={{ width: 16, height: 16, color: '#d97706', flexShrink: 0 }} />
            <span>
              This disposal is <strong>{existing?.status}</strong> and can no longer be edited.
              Use the <strong>Approve</strong> / <strong>Complete</strong> workflow buttons on the Disposal list to advance its status.
            </span>
          </div>
        )}

        {/* fieldset[disabled] disables all descendant form controls when read-only */}
        <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section 1: Group & Estate */}
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

          {/* Section 2: Disposal Details */}
          <section>
            <p className="section-label">Disposal Details</p>
            <div className="form-grid form-grid-3">

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Fixed Asset <span className="required">*</span></label>
                <select
                  id={`${ID}-select-fixedAssetID`}
                  className={`form-control${errors.fixedAssetID ? ' input-error' : ''}`}
                  value={form.fixedAssetID}
                  onChange={e => handleAssetSelect(e.target.value)}
                >
                  <option value="">— Select Asset —</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                      {a.status === 'Disposed' ? ' [Disposed]' : ''}
                    </option>
                  ))}
                </select>
                {errors.fixedAssetID && <span className="field-error">{errors.fixedAssetID}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Disposal Code <span className="required">*</span></label>
                <input
                  id={`${ID}-input-disposalCode`}
                  className={`form-control${errors.disposalCode ? ' input-error' : ''}`}
                  value={form.disposalCode}
                  onChange={e => set('disposalCode', e.target.value.toUpperCase())}
                  placeholder="e.g. AD-0002"
                />
                {errors.disposalCode
                  ? <span className="field-error">{errors.disposalCode}</span>
                  : <span className="field-hint">Auto-generated</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Disposal Date <span className="required">*</span></label>
                <input
                  id={`${ID}-input-disposalDate`}
                  className={`form-control${errors.disposalDate ? ' input-error' : ''}`}
                  type="date"
                  value={form.disposalDate}
                  onChange={e => handleDateChange(e.target.value)}
                />
                {errors.disposalDate && <span className="field-error">{errors.disposalDate}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Disposal Type <span className="required">*</span></label>
                <select
                  id={`${ID}-select-disposalType`}
                  className={`form-control${errors.disposalType ? ' input-error' : ''}`}
                  value={form.disposalType}
                  onChange={e => handleTypeChange(e.target.value)}
                >
                  {DISPOSAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.disposalType && <span className="field-error">{errors.disposalType}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <div style={{
                  padding: '7px 12px',
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}>
                  {form.status || 'Draft'}
                  <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8, color: 'var(--text-muted)' }}>
                    (managed by workflow)
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Approved By</label>
                <input
                  id={`${ID}-input-approvedBy`}
                  className="form-control"
                  value={form.approvedBy}
                  onChange={e => set('approvedBy', e.target.value)}
                  placeholder="Name of approving officer"
                />
              </div>

            </div>
          </section>

          <hr className="divider" />

          {/* Section 3: Financial Impact */}
          <section>
            <p className="section-label">Financial Impact</p>

            {selectedAsset ? (
              <>
                {/* Read-only asset financial summary */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 12, marginBottom: 20,
                  padding: '14px 16px',
                  background: 'var(--bg-page)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                }}>
                  {[
                    { label: 'Asset Cost',        value: `Rs. ${Number(selectedAsset.totalCostOfAsset || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}` },
                    { label: 'Annual Dep.',        value: `Rs. ${Number(selectedAsset.depreciationValue || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}` },
                    { label: 'Residual Value',     value: `Rs. ${Number(selectedAsset.residualValue || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}` },
                    { label: 'Useful Life',        value: `${selectedAsset.usefulLifeYears ?? '—'} yrs` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Book Value at Disposal</label>
                    <input
                      id={`${ID}-input-bookValueAtDisposal`}
                      className="form-control"
                      readOnly
                      value={form.bookValueAtDisposal !== '' ? `Rs. ${Number(form.bookValueAtDisposal).toLocaleString('en-LK', { maximumFractionDigits: 0 })}` : '—'}
                      style={{ background: 'var(--bg-page)', color: 'var(--text-secondary)', cursor: 'default' }}
                    />
                    <span className="field-hint">Computed from depreciation schedule</span>
                  </div>

                  {form.disposalType === 'Sale' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Sale Proceeds (Rs.) <span className="required">*</span></label>
                        <input
                          id={`${ID}-input-saleProceeds`}
                          className={`form-control${errors.saleProceeds ? ' input-error' : ''}`}
                          type="number" min="0" step="1"
                          value={form.saleProceeds}
                          onChange={e => handleSaleProceedsChange(e.target.value)}
                          placeholder="0"
                        />
                        {errors.saleProceeds && <span className="field-error">{errors.saleProceeds}</span>}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Gain / Loss on Disposal</label>
                        <input
                          id={`${ID}-input-gainLossOnDisposal`}
                          className="form-control"
                          readOnly
                          value={form.gainLossOnDisposal !== '' ? (() => {
                            const v = Number(form.gainLossOnDisposal);
                            return `${v >= 0 ? '+' : ''}Rs. ${Math.abs(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
                          })() : '—'}
                          style={{
                            background: 'var(--bg-page)',
                            cursor: 'default',
                            color: form.gainLossOnDisposal !== ''
                              ? (Number(form.gainLossOnDisposal) >= 0 ? 'var(--success)' : 'var(--danger)')
                              : 'var(--text-secondary)',
                            fontWeight: 600,
                          }}
                        />
                        <span className="field-hint">Sale proceeds − book value</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                padding: '20px 0', textAlign: 'center',
                color: 'var(--text-muted)', fontSize: 13,
              }}>
                Select a fixed asset to see the financial impact.
              </div>
            )}
          </section>

          <hr className="divider" />

          {/* Section 4: Reason & Notes */}
          <section>
            <p className="section-label">Reason & Notes</p>
            <div className="form-grid form-grid-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Disposal Reason <span className="required">*</span></label>
                <textarea
                  id={`${ID}-textarea-disposalReason`}
                  className={`form-control${errors.disposalReason ? ' input-error' : ''}`}
                  rows={3}
                  value={form.disposalReason}
                  onChange={e => set('disposalReason', e.target.value)}
                  placeholder="Explain why the asset is being disposed…"
                />
                {errors.disposalReason && <span className="field-error">{errors.disposalReason}</span>}
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea
                  id={`${ID}-textarea-notes`}
                  className="form-control"
                  rows={2}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Optional — buyer name, invoice reference, handover details…"
                />
              </div>
            </div>
          </section>

        </div>
        </fieldset>

        {/* ── Section 5: GL Disposal Journal — outside <fieldset> so workflow buttons are never disabled ── */}
        <div style={{ padding: '0 20px 20px' }}>
          <hr className="divider" />
          <section>
            <p className="section-label" style={{ marginBottom: 12 }}>GL Disposal Journal</p>
            {disposalGL ? (
              <GLEffectPanel
                idPrefix={ID}
                transactionTypeCode={disposalGL.transactionTypeCode}
                fixedAssetTypeID={selectedAsset?.fixedAssetTypeID ?? null}
                fixedAssetCategoryID={selectedAsset?.fixedAssetCategoryID ?? null}
                amount={0}
                amounts={disposalGL.amounts}
                glApprovalStatus={glState.GLApprovalStatus}
                glPostingRef={glState.GLPostingRef}
                glRejectionNote={glState.GLRejectionNote}
                isPostedToGL={glState.IsPostedToGL}
                {...glCallbacks}
              />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>
                Select a fixed asset to preview the GL journal.
              </div>
            )}
            {!isEdit && disposalGL && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                GL posting workflow starts after saving the record.
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="card-footer">
          <button
            id={`${ID}-btn-cancel`}
            className="btn btn-secondary"
            onClick={() => navigate('/asset-disposal')}
          >Cancel</button>
          {!isReadOnly && (
            <button
              id={`${ID}-btn-save`}
              className="btn btn-primary"
              onClick={handleSave}
            >
              <Icon name="check" /> {isEdit ? 'Update Record' : 'Record Disposal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
