import { useState, useMemo } from 'react';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'lc';

const EMPTY = { groupID: '', code: '', name: '' };

function validate(form) {
  const e = {};
  if (!form.groupID)     e.groupID = 'Group is required';
  if (!form.code.trim()) e.code    = 'Code is required';
  else if (form.code.trim().length > 5) e.code = 'Maximum 5 characters';
  if (!form.name.trim()) e.name    = 'License Category Name is required';
  return e;
}

export default function LicenseCategories() {
  const [data, setData]                   = useState(MOCK.licenseCategories);
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
      ? { groupID: row.groupID ?? '', code: row.code, name: row.name }
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
        title="License Categories"
        subtitle="Driver license category definitions — e.g. A, B, CE per national classification"
        columns={[
          { key: 'groupID', label: 'Group', render: v => nameOf.group(v) },
          {
            key: 'code',
            label: 'Category Code',
            render: v => (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36,
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700, fontSize: 13,
              }}>
                {v}
              </span>
            ),
          },
          { key: 'name', label: 'License Category Name' },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add License Category"
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
          title={modal === 'add' ? 'Add License Category' : 'Edit License Category'}
          subtitle={modal === 'add' ? 'Define a driver license category' : `Editing: ${modal.name}`}
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

          {/* License Category Details */}
          <p className="section-label">License Category Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Category Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. B, CE, C1"
                maxLength={5}
              />
              {errors.code
                ? <span className="field-error">{errors.code}</span>
                : <span className="field-hint">National licence class code, max 5 characters</span>}
            </div>

            <div className="form-group">
              <label className="form-label">License Category Name <span className="required">*</span></label>
              <input
                id={`${ID}-input-name`}
                className={`form-control${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Light Motor Vehicles"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          </div>

          {/* Preview */}
          {(form.code || form.name) && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {form.code || '—'}
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {form.name || 'Category name…'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Preview</p>
              </div>
            </div>
          )}
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
                  <div className="card-header-title">Delete License Category</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete license category{' '}
                <strong>{confirmDelete.code}</strong> — {confirmDelete.name}?
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
