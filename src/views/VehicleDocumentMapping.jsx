import { useState, useMemo } from 'react';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'vdm';

const EMPTY = { vehicleID: '', documentTypeID: '', docNumber: '', startDate: '', expireDate: '', notes: '' };

/* Auto-calculate document status from expiry date */
function calcStatus(expireDate, expirationEnabled) {
  if (!expirationEnabled || !expireDate) return 'N/A';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expireDate);
  const daysLeft = Math.ceil((expiry - today) / 86400000);
  if (daysLeft < 0)   return 'Expired';
  if (daysLeft <= 30) return 'Expiring Soon';
  return 'Valid';
}

const STATUS_BADGE = {
  'Valid':         'badge-success',
  'Expiring Soon': 'badge-warning',
  'Expired':       'badge-danger',
  'N/A':           'badge-neutral',
};

function validate(form) {
  const e = {};
  const docType = MOCK.documentTypes.find(d => d.id === Number(form.documentTypeID));
  if (!form.vehicleID)         e.vehicleID      = 'Vehicle is required';
  if (!form.documentTypeID)    e.documentTypeID = 'Document Type is required';
  if (!form.docNumber.trim())  e.docNumber      = 'Document Number is required';
  if (docType?.expirationEnabled) {
    if (!form.startDate)  e.startDate  = 'Start Date is required';
    if (!form.expireDate) e.expireDate = 'Expiry Date is required';
    else if (form.startDate && new Date(form.expireDate) <= new Date(form.startDate))
      e.expireDate = 'Expiry Date must be after Start Date';
  }
  return e;
}

const vehicleLabel = (id) => {
  const v = MOCK.vehicles.find(v => v.id === Number(id));
  return v ? `${v.numbers} — ${v.brand} ${v.model}` : `Vehicle #${id}`;
};

export default function VehicleDocumentMapping() {
  const [data, setData]                   = useState(MOCK.vehicleDocuments);
  const [modal, setModal]                 = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [errors, setErrors]               = useState({});
  const [search, setSearch]               = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* Computed from current form */
  const selectedDocType = MOCK.documentTypes.find(d => d.id === Number(form.documentTypeID));

  const enriched = useMemo(() => data.map(r => {
    const docType = MOCK.documentTypes.find(d => d.id === r.documentTypeID);
    return { ...r, _status: calcStatus(r.expireDate, docType?.expirationEnabled) };
  }), [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return enriched;
    return enriched.filter(r =>
      vehicleLabel(r.vehicleID).toLowerCase().includes(q) ||
      nameOf.docType(r.documentTypeID).toLowerCase().includes(q) ||
      r.docNumber.toLowerCase().includes(q) ||
      r._status.toLowerCase().includes(q)
    );
  }, [enriched, search]);

  const set = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      /* Clear dates if user changes doc type to one without expiration */
      if (key === 'documentTypeID') {
        const dt = MOCK.documentTypes.find(d => d.id === Number(val));
        if (!dt?.expirationEnabled) { next.startDate = ''; next.expireDate = ''; }
      }
      return next;
    });
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = (row) => {
    setForm(row
      ? { vehicleID: row.vehicleID ?? '', documentTypeID: row.documentTypeID ?? '',
          docNumber: row.docNumber ?? '', startDate: row.startDate ?? '',
          expireDate: row.expireDate ?? '', notes: row.notes ?? '' }
      : EMPTY
    );
    setErrors({});
    setModal(row ?? 'add');
  };
  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      ...form,
      vehicleID:      Number(form.vehicleID),
      documentTypeID: Number(form.documentTypeID),
    };
    if (modal === 'add') setData(d => [...d, { id: Date.now(), ...payload }]);
    else setData(d => d.map(r => r.id === modal.id ? { ...r, ...payload } : r));
    close();
  };

  const del = () => {
    setData(d => d.filter(r => r.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Vehicle Document Mapping"
        subtitle="Assign and track required documents per vehicle — licences, insurance, fitness certificates"
        columns={[
          {
            key: 'vehicleID',
            label: 'Vehicle',
            render: v => (
              <span>
                <span className="badge badge-primary" style={{ marginRight: 6 }}>
                  {MOCK.vehicles.find(x => x.id === v)?.numbers ?? `#${v}`}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {(() => { const veh = MOCK.vehicles.find(x => x.id === v); return veh ? `${veh.brand} ${veh.model}` : ''; })()}
                </span>
              </span>
            ),
          },
          { key: 'documentTypeID', label: 'Document Type', render: v => nameOf.docType(v) },
          { key: 'docNumber',      label: 'Document No.',  render: v => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</span> },
          { key: 'startDate',      label: 'Start Date',    render: v => v || <span style={{ color: 'var(--text-muted)' }}>—</span> },
          { key: 'expireDate',     label: 'Expiry Date',   render: v => v || <span style={{ color: 'var(--text-muted)' }}>—</span> },
          {
            key: '_status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Document Mapping"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by vehicle, document type, number or status…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button id={`${ID}-btn-search-clear`} className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} records
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={modal === 'add' ? 'Add Document Mapping' : 'Edit Document Mapping'}
          subtitle={modal === 'add' ? 'Assign a document type to a vehicle' : `Editing: ${nameOf.docType(modal.documentTypeID)} — ${modal.docNumber}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          {/* ── Vehicle ── */}
          <p className="section-label">Vehicle</p>
          <div className="form-group">
            <label className="form-label">Vehicle <span className="required">*</span></label>
            <select
              id={`${ID}-select-vehicle`}
              className={`form-control${errors.vehicleID ? ' input-error' : ''}`}
              value={form.vehicleID}
              onChange={e => set('vehicleID', e.target.value)}
            >
              <option value="">— Select Vehicle —</option>
              {MOCK.vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.numbers} — {v.brand} {v.model}</option>
              ))}
            </select>
            {errors.vehicleID && <span className="field-error">{errors.vehicleID}</span>}
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Document Details ── */}
          <p className="section-label">Document Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Document Type <span className="required">*</span></label>
              <select
                id={`${ID}-select-doc-type`}
                className={`form-control${errors.documentTypeID ? ' input-error' : ''}`}
                value={form.documentTypeID}
                onChange={e => set('documentTypeID', e.target.value)}
              >
                <option value="">— Select Document Type —</option>
                {MOCK.documentTypes.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
              {errors.documentTypeID && <span className="field-error">{errors.documentTypeID}</span>}

              {/* Info banner when doc type is selected */}
              {selectedDocType && (
                <div style={{
                  marginTop: 8, padding: '8px 12px',
                  background: selectedDocType.expirationEnabled ? 'var(--primary-light)' : 'var(--bg-subtle, #f8fafc)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${selectedDocType.expirationEnabled ? 'var(--primary)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: selectedDocType.expirationEnabled ? 'var(--primary-dark)' : 'var(--text-secondary)',
                }}>
                  <Icon name={selectedDocType.expirationEnabled ? 'alert' : 'check'} style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {selectedDocType.expirationEnabled
                    ? 'This document type requires Start Date and Expiry Date — alerts will trigger before expiry.'
                    : 'This document type has no expiration — date fields are not required.'}
                </div>
              )}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Document Number <span className="required">*</span></label>
              <input
                id={`${ID}-input-doc-number`}
                className={`form-control${errors.docNumber ? ' input-error' : ''}`}
                value={form.docNumber}
                onChange={e => set('docNumber', e.target.value.toUpperCase())}
                placeholder="e.g. RL-2026-001"
              />
              {errors.docNumber && <span className="field-error">{errors.docNumber}</span>}
            </div>

            {/* Conditional date fields — only when expirationEnabled */}
            {selectedDocType?.expirationEnabled && (
              <>
                <div className="form-group">
                  <label className="form-label">Start Date <span className="required">*</span></label>
                  <input
                    id={`${ID}-input-start-date`}
                    type="date"
                    className={`form-control${errors.startDate ? ' input-error' : ''}`}
                    value={form.startDate}
                    onChange={e => set('startDate', e.target.value)}
                  />
                  {errors.startDate && <span className="field-error">{errors.startDate}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date <span className="required">*</span></label>
                  <input
                    id={`${ID}-input-expire-date`}
                    type="date"
                    className={`form-control${errors.expireDate ? ' input-error' : ''}`}
                    value={form.expireDate}
                    onChange={e => set('expireDate', e.target.value)}
                  />
                  {errors.expireDate && <span className="field-error">{errors.expireDate}</span>}
                </div>

                {/* Live status preview */}
                {(form.startDate || form.expireDate) && (() => {
                  const st = calcStatus(form.expireDate, true);
                  return (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      Status preview:
                      <span className={`badge ${STATUS_BADGE[st] ?? 'badge-neutral'}`}>{st}</span>
                    </div>
                  );
                })()}
              </>
            )}

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notes</label>
              <textarea
                id={`${ID}-textarea-notes`}
                className="form-control"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Optional notes about this document"
                rows={2}
              />
            </div>
          </div>
        </FormModal>
      )}

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#fee2e2', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Remove Document Mapping</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Remove <strong>{nameOf.docType(confirmDelete.documentTypeID)}</strong>{' '}
                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>({confirmDelete.docNumber})</span> from{' '}
                <strong>{vehicleLabel(confirmDelete.vehicleID)}</strong>?
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={del}>
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
