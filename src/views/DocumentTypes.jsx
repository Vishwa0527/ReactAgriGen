import { useState, useMemo } from 'react';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'dt';

const EMPTY = { groupID: '', code: '', name: '', expirationEnabled: false };

function validate(form) {
  const e = {};
  if (!form.groupID)     e.groupID = 'Group is required';
  if (!form.code.trim()) e.code    = 'Code is required';
  else if (form.code.trim().length > 10) e.code = 'Maximum 10 characters';
  if (!form.name.trim()) e.name    = 'Document Type Name is required';
  return e;
}

export default function DocumentTypes() {
  const [data, setData]                   = useState(MOCK.documentTypes);
  const [modal, setModal]                 = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [errors, setErrors]               = useState({});
  const [search, setSearch]               = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(r =>
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      nameOf.group(r.groupID).toLowerCase().includes(q)
    );
  }, [data, search]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = (row) => {
    setForm(row
      ? { groupID: row.groupID ?? '', code: row.code, name: row.name, expirationEnabled: row.expirationEnabled ?? false }
      : EMPTY
    );
    setErrors({});
    setModal(row ?? 'add');
  };
  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = { ...form, groupID: Number(form.groupID) };
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
        title="Document Types"
        subtitle="Vehicle document type definitions — e.g. licence, insurance, fitness certificate"
        columns={[
          { key: 'groupID', label: 'Group', render: v => nameOf.group(v) },
          { key: 'code',    label: 'Code',  render: v => <span className="badge badge-primary">{v}</span> },
          { key: 'name',    label: 'Document Type Name' },
          {
            key: 'expirationEnabled',
            label: 'Expiration',
            render: v => (
              <span className={`badge ${v ? 'badge-warning' : 'badge-neutral'}`}>
                {v ? 'Required' : 'Not Required'}
              </span>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Document Type"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name or group…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button
                id={`${ID}-btn-search-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => setSearch('')}
              >
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
          title={modal === 'add' ? 'Add Document Type' : 'Edit Document Type'}
          subtitle={modal === 'add' ? 'Define a new vehicle document type' : `Editing: ${modal.name}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          {/* Group */}
          <p className="section-label">Group</p>
          <div className="form-group">
            <label className="form-label">Group <span className="required">*</span></label>
            <select
              id={`${ID}-select-group`}
              className={`form-control${errors.groupID ? ' input-error' : ''}`}
              value={form.groupID}
              onChange={e => set('groupID', e.target.value)}
            >
              <option value="">— Select Group —</option>
              {MOCK.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {errors.groupID && <span className="field-error">{errors.groupID}</span>}
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* Document Type Details */}
          <p className="section-label">Document Type Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. RL"
                maxLength={10}
              />
              {errors.code
                ? <span className="field-error">{errors.code}</span>
                : <span className="field-hint">Short unique code, max 10 characters</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Document Type Name <span className="required">*</span></label>
              <input
                id={`${ID}-input-name`}
                className={`form-control${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Revenue Licence"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            {/* Expiration toggle — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div
                id={`${ID}-toggle-expiration`}
                onClick={() => set('expirationEnabled', !form.expirationEnabled)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px',
                  border: `1px solid ${form.expirationEnabled ? 'var(--warning)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: form.expirationEnabled ? '#fffbeb' : 'var(--bg-page)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  id={`${ID}-checkbox-expiration`}
                  type="checkbox"
                  checked={form.expirationEnabled}
                  onChange={e => set('expirationEnabled', e.target.checked)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 15, height: 15, marginTop: 2, accentColor: 'var(--warning)', cursor: 'pointer', flexShrink: 0 }}
                />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    Expiration Date Required
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Enable this if the document must have a start and expiry date (e.g. Insurance, Revenue Licence).
                    Alerts will be triggered as the expiry approaches.
                  </p>
                </div>
              </div>
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
                  <div className="card-header-title">Delete Document Type</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete <strong>{confirmDelete.name}</strong>{' '}
                <span className="badge badge-neutral" style={{ verticalAlign: 'middle' }}>{confirmDelete.code}</span>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Group: {nameOf.group(confirmDelete.groupID)}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={del}>
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
