import { useState, useMemo } from 'react';
import { fixedAssetCategoryStore } from '../data/fixedAssetCategoryStore';
import { fixedAssetTypeStore } from '../data/fixedAssetTypeStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'fac';

const EMPTY = { fixedAssetTypeID: '', code: '', name: '', desc: '' };

function validate(form, editingID) {
  const e = {};
  if (!form.fixedAssetTypeID) e.fixedAssetTypeID = 'Asset Type is required';
  if (!form.code.trim()) {
    e.code = 'Code is required';
  } else if (!fixedAssetCategoryStore.isCodeUnique(form.code.trim().toUpperCase(), editingID)) {
    e.code = 'This code is already in use';
  }
  if (!form.name.trim()) e.name = 'Name is required';
  return e;
}

export default function FixedAssetCategories() {
  const [data, setData]               = useState(() => fixedAssetCategoryStore.getAll());
  const [assetTypes]                  = useState(() => fixedAssetTypeStore.getAll());
  const [modal, setModal]             = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [search, setSearch]           = useState('');
  const [filterTypeID, setFilterTypeID] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* id → name map for the parent type column and preview */
  const typeNameMap = useMemo(() =>
    Object.fromEntries(assetTypes.map(t => [t.id, t.name])),
    [assetTypes]
  );

  const filtered = useMemo(() => {
    let rows = data;
    if (filterTypeID) rows = rows.filter(r => r.fixedAssetTypeID === Number(filterTypeID));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.desc ?? '').toLowerCase().includes(q) ||
        (typeNameMap[r.fixedAssetTypeID] ?? '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, search, filterTypeID, typeNameMap]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = row => {
    setForm(row
      ? { fixedAssetTypeID: row.fixedAssetTypeID ?? '', code: row.code ?? '', name: row.name ?? '', desc: row.desc ?? '' }
      : { ...EMPTY, code: fixedAssetCategoryStore.nextCode() }
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
      fixedAssetTypeID: Number(form.fixedAssetTypeID),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      desc: form.desc.trim(),
    };
    if (modal === 'add') fixedAssetCategoryStore.add(payload);
    else                 fixedAssetCategoryStore.update(modal.id, payload);
    setData(fixedAssetCategoryStore.getAll());
    close();
  };

  const del = () => {
    fixedAssetCategoryStore.remove(confirmDelete.id);
    setData(fixedAssetCategoryStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Fixed Asset Categories"
        subtitle="Sub-classifications under each Fixed Asset Type — used in the Asset Register"
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: v => (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 64, padding: '0 10px', height: 32,
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13,
              }}>
                {v}
              </span>
            ),
          },
          {
            key: 'fixedAssetTypeID',
            label: 'Asset Type',
            render: v => (
              <span className="badge badge-neutral" style={{ fontSize: 12 }}>
                {typeNameMap[v] ?? `Type #${v}`}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name or description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
              <select
                id={`${ID}-select-type`}
                className="form-control"
                value={filterTypeID}
                onChange={e => setFilterTypeID(e.target.value)}
              >
                <option value="">All Asset Types</option>
                {assetTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {(search || filterTypeID) && (
              <button id={`${ID}-btn-filter-clear`} className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterTypeID(''); }}>Clear</button>
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
          title={modal === 'add' ? 'Add Fixed Asset Category' : 'Edit Fixed Asset Category'}
          subtitle={modal === 'add' ? 'Create a sub-classification under a Fixed Asset Type' : `Editing: ${modal.name}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          <p className="section-label">Classification</p>
          <div className="form-group">
            <label className="form-label">Fixed Asset Type <span className="required">*</span></label>
            <select
              id={`${ID}-select-fixedAssetTypeID`}
              className={`form-control${errors.fixedAssetTypeID ? ' input-error' : ''}`}
              value={form.fixedAssetTypeID}
              onChange={e => set('fixedAssetTypeID', e.target.value)}
            >
              <option value="">— Select Asset Type —</option>
              {assetTypes.map(t => (
                <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
              ))}
            </select>
            {errors.fixedAssetTypeID && <span className="field-error">{errors.fixedAssetTypeID}</span>}
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          <p className="section-label">Category Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. FAC005"
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
                placeholder="e.g. Motor Cycles"
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
                minWidth: 56, padding: '0 10px', height: 44,
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
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {form.fixedAssetTypeID
                    ? typeNameMap[Number(form.fixedAssetTypeID)] ?? ''
                    : 'Select a type…'
                  }
                </p>
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
                  <div className="card-header-title">Delete Fixed Asset Category</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete category{' '}
                <span style={{
                  display: 'inline-flex', padding: '1px 8px',
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 12, verticalAlign: 'middle', margin: '0 4px',
                }}>
                  {confirmDelete.code}
                </span>
                <strong>{confirmDelete.name}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {typeNameMap[confirmDelete.fixedAssetTypeID] ?? ''}
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
