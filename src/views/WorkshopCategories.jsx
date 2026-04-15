import { useState, useMemo } from 'react';
import { workshopCategoryStore } from '../data/workshopCategoryStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'wcat';

const EMPTY = { code: '', name: '', desc: '' };

function validate(form, editingID) {
  const e = {};
  if (!form.code.trim()) {
    e.code = 'Code is required';
  } else if (!workshopCategoryStore.isCodeUnique(form.code.trim().toUpperCase(), editingID)) {
    e.code = 'This code is already in use';
  }
  if (!form.name.trim()) e.name = 'Name is required';
  return e;
}

export default function WorkshopCategories() {
  const [data, setData]               = useState(() => workshopCategoryStore.getAll());
  const [modal, setModal]             = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(r =>
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      (r.desc ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = row => {
    setForm(row
      ? { code: row.code ?? '', name: row.name ?? '', desc: row.desc ?? '' }
      : { ...EMPTY, code: workshopCategoryStore.nextCode() }
    );
    setErrors({});
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const editingID = modal !== 'add' ? modal.id : null;
    const errs = validate(form, editingID);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      desc: form.desc.trim(),
    };
    if (modal === 'add') workshopCategoryStore.add(payload);
    else                 workshopCategoryStore.update(modal.id, payload);
    setData(workshopCategoryStore.getAll());
    close();
  };

  const del = () => {
    workshopCategoryStore.remove(confirmDelete.id);
    setData(workshopCategoryStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Workshop Categories"
        subtitle="Classify workshops by service type — e.g. Vehicle Repair, Electrical Works"
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: v => (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 60, padding: '0 10px', height: 32,
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13,
              }}>
                {v}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Category Name',
            render: v => <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</strong>,
          },
          {
            key: 'desc',
            label: 'Description',
            render: v => v
              ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>
              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Category"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name or description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button id={`${ID}-btn-search-clear`} className="btn btn-secondary btn-sm"
                onClick={() => setSearch('')}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} categories
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={modal === 'add' ? 'Add Workshop Category' : 'Edit Workshop Category'}
          subtitle={modal === 'add' ? 'Define a new workshop service classification' : `Editing: ${modal.name}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          <p className="section-label">Category Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. WC004"
                maxLength={10}
              />
              {errors.code
                ? <span className="field-error">{errors.code}</span>
                : <span className="field-hint">Auto-generated — you may edit if needed</span>
              }
            </div>

            <div className="form-group">
              <label className="form-label">Category Name <span className="required">*</span></label>
              <input
                id={`${ID}-input-name`}
                className={`form-control${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Electrical Works"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Description</label>
              <textarea
                id={`${ID}-textarea-desc`}
                className="form-control"
                value={form.desc}
                onChange={e => set('desc', e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>

          {/* Live preview */}
          {(form.code || form.name) && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{
                minWidth: 52, padding: '0 10px', height: 44,
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13, flexShrink: 0,
              }}>
                {form.code || '—'}
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {form.name || 'Category name…'}
                </p>
                {form.desc && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{form.desc}</p>
                )}
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
                  <div className="card-header-title">Delete Workshop Category</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete workshop category{' '}
                <span style={{
                  display: 'inline-flex', padding: '1px 8px',
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 12, verticalAlign: 'middle', margin: '0 4px',
                }}>
                  {confirmDelete.code}
                </span>
                <strong>{confirmDelete.name}</strong>?
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
