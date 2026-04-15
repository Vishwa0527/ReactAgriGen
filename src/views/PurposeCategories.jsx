import { useState, useMemo } from 'react';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'pc';

/* Predefined ERP modules this category can relate to */
const ERP_MODULES = ['Field', 'Inventory', 'HR', 'Production', 'Finance', 'Fleet', 'Other'];

const EMPTY = { groupID: '', code: '', name: '', module: '' };

function validate(form) {
  const e = {};
  if (!form.groupID)     e.groupID = 'Group is required';
  if (!form.code.trim()) e.code    = 'Code is required';
  else if (form.code.trim().length > 10) e.code = 'Maximum 10 characters';
  if (!form.name.trim()) e.name    = 'Purpose Name is required';
  if (!form.module)      e.module  = 'Module is required';
  return e;
}

/* Module badge colour map */
const MODULE_BADGE = {
  Field:      'badge-success',
  Inventory:  'badge-warning',
  HR:         'badge-info',
  Production: 'badge-primary',
  Finance:    'badge-danger',
  Fleet:      'badge-neutral',
  Other:      'badge-neutral',
};

export default function PurposeCategories() {
  const [data, setData]                   = useState(MOCK.purposeCategories);
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
      (r.module || '').toLowerCase().includes(q) ||
      nameOf.group(r.groupID).toLowerCase().includes(q)
    );
  }, [data, search]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = (row) => {
    setForm(row
      ? { groupID: row.groupID ?? '', code: row.code, name: row.name, module: row.module ?? '' }
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
        title="Purpose Categories"
        subtitle="Vehicle purpose categories — defines what a vehicle is used for within each ERP module"
        columns={[
          { key: 'groupID', label: 'Group', render: v => nameOf.group(v) },
          { key: 'code',    label: 'Code',  render: v => <span className="badge badge-primary">{v}</span> },
          { key: 'name',    label: 'Purpose Name' },
          {
            key: 'module',
            label: 'ERP Module',
            render: v => <span className={`badge ${MODULE_BADGE[v] ?? 'badge-neutral'}`}>{v || '—'}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Purpose Category"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name, module or group…"
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
          title={modal === 'add' ? 'Add Purpose Category' : 'Edit Purpose Category'}
          subtitle={modal === 'add' ? 'Define a vehicle usage purpose for an ERP module' : `Editing: ${modal.name}`}
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

          {/* Purpose Details */}
          <p className="section-label">Purpose Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. PC001"
                maxLength={10}
              />
              {errors.code
                ? <span className="field-error">{errors.code}</span>
                : <span className="field-hint">Unique code, max 10 characters</span>}
            </div>

            <div className="form-group">
              <label className="form-label">ERP Module <span className="required">*</span></label>
              <select
                id={`${ID}-select-module`}
                className={`form-control${errors.module ? ' input-error' : ''}`}
                value={form.module}
                onChange={e => set('module', e.target.value)}
              >
                <option value="">— Select Module —</option>
                {ERP_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {errors.module
                ? <span className="field-error">{errors.module}</span>
                : <span className="field-hint">Which ERP module uses this purpose</span>}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Purpose Name <span className="required">*</span></label>
              <input
                id={`${ID}-input-name`}
                className={`form-control${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Field Transport"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          </div>

          {/* Module preview badge */}
          {form.module && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              Module tag preview:
              <span className={`badge ${MODULE_BADGE[form.module] ?? 'badge-neutral'}`}>{form.module}</span>
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
                  <div className="card-header-title">Delete Purpose Category</div>
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
                {confirmDelete.module && <> &nbsp;·&nbsp; Module: <span className={`badge ${MODULE_BADGE[confirmDelete.module] ?? 'badge-neutral'}`} style={{ verticalAlign: 'middle' }}>{confirmDelete.module}</span></>}
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
