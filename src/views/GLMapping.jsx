/**
 * GL Account Mapping configuration screen.
 * Admin configures Dr/Cr account assignments per transaction type.
 * The GL Engine reads these mappings at posting time.
 *
 * ID prefix: glm
 */
import { useState, useMemo } from 'react';
import { glMappingStore }      from '../data/glMappingStore';
import { ledgerAccountStore }  from '../data/ledgerAccountStore';
import { MOCK }                from '../data/mockData';
import { FormModal }           from '../components/FormModal';
import { Icon }                from '../components/Icon';

const ID = 'glm';

const LINE_ROLE_OPTIONS = [
  { value: 'FULL_AMOUNT', label: 'Full Amount',       desc: 'Single total amount — standard 2-line journal' },
  { value: 'ACCUM_DEP',   label: 'Accum. Dep.',       desc: 'Accumulated depreciation portion (disposal)' },
  { value: 'PROCEEDS',    label: 'Sale Proceeds',      desc: 'Disposal proceeds receivable' },
  { value: 'ASSET_COST',  label: 'Asset Cost',         desc: 'Original purchase cost of the asset' },
  { value: 'GAIN_AMOUNT', label: 'Gain on Disposal',   desc: 'Gain recognised on asset disposal' },
  { value: 'LOSS_AMOUNT', label: 'Loss on Disposal',   desc: 'Loss recognised on disposal or write-off' },
];

const MODULE_BADGE = {
  FA:    { label: 'FA',    cls: 'badge-primary' },
  FLEET: { label: 'Fleet', cls: 'badge-warning' },
};

const DRCR_BADGE = { DR: 'badge-primary', CR: 'badge-success' };

const EMPTY_LINE = {
  glMappingHeaderID: '',
  lineDescription:   '',
  drCr:              'DR',
  ledgerAccountID:   '',
  fixedAssetTypeID:  '',
  fixedAssetCategoryID: '',
  lineRole:          'FULL_AMOUNT',
  sortOrder:         '',
};

function validate(form) {
  const e = {};
  if (!form.drCr)            e.drCr            = 'Required';
  if (!form.ledgerAccountID) e.ledgerAccountID  = 'Account is required';
  if (!form.lineRole)        e.lineRole         = 'Required';
  if (!form.sortOrder || isNaN(Number(form.sortOrder)) || Number(form.sortOrder) < 1)
    e.sortOrder = 'Enter a valid sort order';
  return e;
}

export default function GLMapping() {
  const headers                           = useMemo(() => glMappingStore.getAllHeaders(), []);
  const [mappings, setMappings]           = useState(() => glMappingStore.getAllMappings());
  const [selectedID, setSelectedID]       = useState(headers[0]?.id ?? null);

  const [modal, setModal]                 = useState(null);   // null | 'add' | line-object
  const [form, setForm]                   = useState(EMPTY_LINE);
  const [errors, setErrors]               = useState({});
  const [confirmDeactivate, setDeactivate] = useState(null);

  const accounts     = useMemo(() => ledgerAccountStore.getActive(), []);
  const faTypes      = MOCK.fixedAssetTypes;
  const faCategories = MOCK.fixedAssetCategories;

  const selectedHeader = headers.find(h => h.id === selectedID);

  const lines = useMemo(() =>
    mappings
      .filter(m => m.glMappingHeaderID === selectedID)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [mappings, selectedID]
  );

  const activeCount = (headerID) =>
    mappings.filter(m => m.glMappingHeaderID === headerID && m.isActive).length;

  const filteredCategories = useMemo(() =>
    form.fixedAssetTypeID
      ? faCategories.filter(c => c.fixedAssetTypeID === Number(form.fixedAssetTypeID))
      : faCategories,
    [form.fixedAssetTypeID, faCategories]
  );

  /* ── form helpers ─────────────────────────────────────────────── */
  const set = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === 'fixedAssetTypeID') next.fixedAssetCategoryID = '';
      return next;
    });
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const openAdd = () => {
    setForm({ ...EMPTY_LINE, glMappingHeaderID: selectedID, sortOrder: lines.length + 1 });
    setErrors({});
    setModal('add');
  };

  const openEdit = (line) => {
    setForm({
      ...line,
      fixedAssetTypeID:     line.fixedAssetTypeID     ?? '',
      fixedAssetCategoryID: line.fixedAssetCategoryID ?? '',
    });
    setErrors({});
    setModal(line);
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const account = accounts.find(a => a.id === Number(form.ledgerAccountID));
    const payload = {
      ...form,
      glMappingHeaderID:    Number(form.glMappingHeaderID),
      ledgerAccountID:      Number(form.ledgerAccountID),
      fixedAssetTypeID:     form.fixedAssetTypeID     ? Number(form.fixedAssetTypeID)     : null,
      fixedAssetCategoryID: form.fixedAssetCategoryID ? Number(form.fixedAssetCategoryID) : null,
      sortOrder:            Number(form.sortOrder),
      lineDescription:      form.lineDescription.trim() || `${form.drCr}: ${account?.accountName ?? ''}`,
      isActive:             true,
    };

    if (modal === 'add') {
      glMappingStore.addMappingLine(payload);
    } else {
      glMappingStore.updateMappingLine(modal.id, payload);
    }
    setMappings(glMappingStore.getAllMappings());
    close();
  };

  const doDeactivate = () => {
    glMappingStore.deactivateMappingLine(confirmDeactivate.id);
    setMappings(glMappingStore.getAllMappings());
    setDeactivate(null);
  };

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <div className="fade-up">

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          GL Account Mapping
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Configure Dr/Cr account assignments for each transaction type.
          The GL engine reads these mappings at posting time using account-type-category priority resolution.
        </p>
      </div>

      {/* Transaction type tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {headers.map(h => {
          const mod  = MODULE_BADGE[h.moduleCode] ?? { label: h.moduleCode, cls: 'badge-neutral' };
          const cnt  = activeCount(h.id);
          const sel  = selectedID === h.id;
          return (
            <button
              key={h.id}
              id={`${ID}-tab-${h.transactionTypeCode.toLowerCase()}`}
              onClick={() => setSelectedID(h.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                background: sel ? 'var(--primary-light)' : 'var(--bg-card)',
                color: sel ? 'var(--primary-dark)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: sel ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
            >
              <span className={`badge ${mod.cls}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                {mod.label}
              </span>
              <span>{h.transactionTypeName}</span>
              <span style={{
                minWidth: 20, height: 20, borderRadius: '50%',
                background: sel ? 'var(--primary)' : 'var(--bg-subtle)',
                color: sel ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Lines card for selected header */}
      {selectedHeader && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <div className="card-header-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${MODULE_BADGE[selectedHeader.moduleCode]?.cls ?? 'badge-neutral'}`}>
                    {MODULE_BADGE[selectedHeader.moduleCode]?.label ?? selectedHeader.moduleCode}
                  </span>
                  {selectedHeader.transactionTypeName}
                </div>
                <div className="card-header-sub">{selectedHeader.description}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {selectedHeader.transactionTypeCode}
                </div>
              </div>
              <button
                id={`${ID}-btn-add-line`}
                className="btn btn-primary btn-sm"
                onClick={openAdd}
                style={{ flexShrink: 0 }}
              >
                <Icon name="plus" style={{ width: 13, height: 13 }} /> Add Line
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {lines.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                <Icon name="link" style={{ width: 32, height: 32, color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ marginTop: 8 }}>No mapping lines configured for this transaction type.</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Add Dr/Cr lines to enable GL posting.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ margin: 0, minWidth: 780 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th style={{ width: 60 }}>Dr/Cr</th>
                      <th style={{ minWidth: 200 }}>Line Description</th>
                      <th style={{ minWidth: 220 }}>Account</th>
                      <th style={{ width: 140 }}>Asset Type</th>
                      <th style={{ width: 120 }}>Category</th>
                      <th style={{ width: 130 }}>Amount Role</th>
                      <th style={{ width: 72 }}>Status</th>
                      <th style={{ width: 80 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => {
                      const acct  = accounts.find(a => a.id === line.ledgerAccountID);
                      const faTyp = faTypes.find(t => t.id === line.fixedAssetTypeID);
                      const faCat = faCategories.find(c => c.id === line.fixedAssetCategoryID);
                      return (
                        <tr key={line.id} style={{ opacity: line.isActive ? 1 : 0.45 }}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                            {line.sortOrder}
                          </td>
                          <td>
                            <span className={`badge ${DRCR_BADGE[line.drCr] ?? 'badge-neutral'}`}>
                              {line.drCr}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {line.lineDescription}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                              {acct?.accountCode ?? `#${line.ledgerAccountID}`}
                            </span>
                            <span style={{ fontSize: 12 }}>{acct?.accountName}</span>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {faTyp
                              ? <span className="badge badge-neutral">{faTyp.name}</span>
                              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>All Types</span>
                            }
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {faCat
                              ? <span className="badge badge-neutral">{faCat.name}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td>
                            <span style={{
                              fontSize: 10, padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
                              fontFamily: 'monospace', whiteSpace: 'nowrap',
                            }}>
                              {line.lineRole}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${line.isActive ? 'badge-success' : 'badge-neutral'}`}>
                              {line.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                id={`${ID}-btn-edit-${line.id}`}
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEdit(line)}
                                disabled={!line.isActive}
                                title="Edit"
                              >
                                <Icon name="edit" style={{ width: 12, height: 12 }} />
                              </button>
                              {line.isActive && (
                                <button
                                  id={`${ID}-btn-deactivate-${line.id}`}
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setDeactivate(line)}
                                  title="Deactivate"
                                >
                                  <Icon name="trash" style={{ width: 12, height: 12 }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer stats */}
          {lines.length > 0 && (() => {
            const active = lines.filter(l => l.isActive);
            const drCnt  = active.filter(l => l.drCr === 'DR').length;
            const crCnt  = active.filter(l => l.drCr === 'CR').length;
            return (
              <div className="card-footer" style={{
                display: 'flex', gap: 20, fontSize: 12,
                color: 'var(--text-secondary)', flexWrap: 'wrap',
              }}>
                <span>{active.length} active line{active.length !== 1 ? 's' : ''}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{drCnt} DR</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>{crCnt} CR</span>
                {lines.length - active.length > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {lines.length - active.length} inactive
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Add / Edit Line Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={modal === 'add' ? 'Add Mapping Line' : 'Edit Mapping Line'}
          subtitle={selectedHeader?.transactionTypeName}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          <div className="form-grid form-grid-2">

            {/* Dr/Cr */}
            <div className="form-group">
              <label className="form-label">Dr / Cr <span className="required">*</span></label>
              <select
                id={`${ID}-select-drcr`}
                className={`form-control${errors.drCr ? ' input-error' : ''}`}
                value={form.drCr}
                onChange={e => set('drCr', e.target.value)}
              >
                <option value="DR">DR — Debit</option>
                <option value="CR">CR — Credit</option>
              </select>
              {errors.drCr && <span className="field-error">{errors.drCr}</span>}
            </div>

            {/* Sort Order */}
            <div className="form-group">
              <label className="form-label">Sort Order <span className="required">*</span></label>
              <input
                id={`${ID}-input-sort-order`}
                type="number"
                className={`form-control${errors.sortOrder ? ' input-error' : ''}`}
                value={form.sortOrder}
                onChange={e => set('sortOrder', e.target.value)}
                min={1}
                placeholder="e.g. 1"
              />
              {errors.sortOrder && <span className="field-error">{errors.sortOrder}</span>}
            </div>

            {/* Ledger Account */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Ledger Account <span className="required">*</span></label>
              <select
                id={`${ID}-select-account`}
                className={`form-control${errors.ledgerAccountID ? ' input-error' : ''}`}
                value={form.ledgerAccountID}
                onChange={e => set('ledgerAccountID', e.target.value)}
              >
                <option value="">— Select Account —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.accountCode} — {a.accountName}</option>
                ))}
              </select>
              {errors.ledgerAccountID && <span className="field-error">{errors.ledgerAccountID}</span>}
            </div>

            {/* Line Description */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Line Description</label>
              <input
                id={`${ID}-input-line-desc`}
                className="form-control"
                value={form.lineDescription}
                onChange={e => set('lineDescription', e.target.value)}
                placeholder="Auto-filled from Dr/Cr + account name if left blank"
              />
            </div>

            {/* Asset Type filter */}
            <div className="form-group">
              <label className="form-label">Asset Type Filter</label>
              <select
                id={`${ID}-select-asset-type`}
                className="form-control"
                value={form.fixedAssetTypeID}
                onChange={e => set('fixedAssetTypeID', e.target.value)}
              >
                <option value="">— All Types (Global Fallback) —</option>
                {faTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
                Leave blank for a global mapping that applies to all asset types
              </span>
            </div>

            {/* Category filter */}
            <div className="form-group">
              <label className="form-label">Category Filter</label>
              <select
                id={`${ID}-select-category`}
                className="form-control"
                value={form.fixedAssetCategoryID}
                onChange={e => set('fixedAssetCategoryID', e.target.value)}
                disabled={!form.fixedAssetTypeID}
              >
                <option value="">— All Categories —</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
                Category-level mapping overrides type-level fallback
              </span>
            </div>

            {/* Amount Role */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Amount Role <span className="required">*</span></label>
              <select
                id={`${ID}-select-line-role`}
                className={`form-control${errors.lineRole ? ' input-error' : ''}`}
                value={form.lineRole}
                onChange={e => set('lineRole', e.target.value)}
              >
                {LINE_ROLE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
                ))}
              </select>
              {errors.lineRole && <span className="field-error">{errors.lineRole}</span>}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
                Use <strong>Full Amount</strong> for standard 2-line journals.
                Disposal types use specific roles (Accum. Dep., Proceeds, Asset Cost, Gain/Loss).
              </span>
            </div>

          </div>
        </FormModal>
      )}

      {/* ── Deactivate Confirmation ── */}
      {confirmDeactivate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: '#fee2e2', color: 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Deactivate Mapping Line</div>
                  <div className="card-header-sub">The line will no longer be used by the GL engine</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Deactivate <strong>{confirmDeactivate.lineDescription}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                The line will remain visible as inactive. This cannot affect already-posted journal entries.
              </p>
            </div>
            <div className="card-footer">
              <button
                id={`${ID}-btn-deactivate-cancel`}
                className="btn btn-secondary"
                onClick={() => setDeactivate(null)}
              >
                Cancel
              </button>
              <button
                id={`${ID}-btn-deactivate-confirm`}
                className="btn btn-danger"
                onClick={doDeactivate}
              >
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
