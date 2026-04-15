import { useState, useMemo } from 'react';
import { MOCK, nameOf } from '../data/mockData';
import { workshopStore } from '../data/workshopStore';
import { workshopCategoryStore } from '../data/workshopCategoryStore';
import { fixedAssetTypeStore } from '../data/fixedAssetTypeStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { GroupEstateFields } from '../components/GroupEstateFields';
import { Icon } from '../components/Icon';

const ID = 'ws';

const EMPTY = { code: '', name: '', groupID: '', estateID: '', workshopCategoryID: '', fixedAssetTypeID: '', status: 'Active' };

const STATUS_BADGE = { Active: 'badge-success', Inactive: 'badge-neutral' };

function validate(form, editingID) {
  const e = {};
  if (!form.workshopCategoryID) e.workshopCategoryID = 'Category is required';
  if (!form.groupID)     e.groupID  = 'Group is required';
  if (!form.estateID)    e.estateID = 'Estate is required';
  if (!form.code.trim()) {
    e.code = 'Code is required';
  } else if (!workshopStore.isCodeUnique(form.code.trim().toUpperCase(), editingID)) {
    e.code = 'This code is already in use';
  }
  if (!form.name.trim()) e.name = 'Workshop name is required';
  return e;
}

export default function Workshops() {
  const [data, setData]               = useState(() => workshopStore.getAll());
  const [modal, setModal]             = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [filterStatus, setFilterStatus] = useState('Active');
  const [filterCategoryID, setFilterCategoryID] = useState('');
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [workshopCategories]          = useState(() => workshopCategoryStore.getAll());
  const [assetTypes]                  = useState(() => fixedAssetTypeStore.getAll());

  const enriched = useMemo(() => data.map(w => ({
    ...w,
    _group:    MOCK.groups.find(g => g.id === w.groupID),
    _estate:   MOCK.estates.find(e => e.id === w.estateID),
    _category:  workshopCategories.find(c => c.id === w.workshopCategoryID),
    _assetType: assetTypes.find(t => t.id === w.fixedAssetTypeID),
  })), [data, workshopCategories, assetTypes]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterCategoryID) result = result.filter(r => r.workshopCategoryID === Number(filterCategoryID));
    if (filterStatus !== 'All') result = result.filter(r => r.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.code?.toLowerCase().includes(q)           ||
        r.name?.toLowerCase().includes(q)           ||
        r._group?.name?.toLowerCase().includes(q)   ||
        r._estate?.name?.toLowerCase().includes(q)  ||
        r._category?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterCategoryID, filterStatus, search]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = row => {
    setForm(row
      ? { code: row.code ?? '', name: row.name ?? '', groupID: row.groupID ?? '',
          estateID: row.estateID ?? '', workshopCategoryID: row.workshopCategoryID ?? '',
          fixedAssetTypeID: row.fixedAssetTypeID ?? '', status: row.status ?? 'Active' }
      : { ...EMPTY, code: workshopStore.nextCode() }
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
      ...form,
      code:               form.code.trim().toUpperCase(),
      name:               form.name.trim(),
      groupID:            Number(form.groupID),
      estateID:           Number(form.estateID),
      workshopCategoryID: Number(form.workshopCategoryID),
      fixedAssetTypeID:   form.fixedAssetTypeID ? Number(form.fixedAssetTypeID) : null,
    };
    if (modal === 'add') workshopStore.add(payload);
    else                 workshopStore.update(modal.id, payload);
    setData(workshopStore.getAll());
    close();
  };

  const del = () => {
    workshopStore.remove(confirmDelete.id);
    setData(workshopStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Workshops"
        subtitle="Register vehicle maintenance workshops per estate"
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: v => <span className="badge badge-neutral">{v}</span>,
          },
          {
            key: 'name',
            label: 'Workshop Name',
            render: v => <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</strong>,
          },
          {
            key: '_category',
            label: 'Category',
            render: v => v
              ? <span className="badge badge-neutral" style={{ fontSize: 12 }}>{v.name}</span>
              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>,
          },
          {
            key: '_assetType',
            label: 'Asset Type',
            render: v => v
              ? <span className="badge badge-primary" style={{ fontSize: 12 }}>{v.name}</span>
              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>,
          },
          {
            key: '_group',
            label: 'Group',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v?.name ?? '—'}</span>,
          },
          {
            key: '_estate',
            label: 'Estate',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v?.name ?? '—'}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Workshop"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Category filter */}
            <select
              id={`${ID}-select-category`}
              className="form-control"
              style={{ minWidth: 180 }}
              value={filterCategoryID}
              onChange={e => setFilterCategoryID(e.target.value)}
            >
              <option value="">All Categories</option>
              {workshopCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Status segmented filter */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
              {['All', 'Active', 'Inactive'].map((s, i, arr) => (
                <button
                  key={s}
                  id={`${ID}-btn-status-${s.toLowerCase()}`}
                  style={{
                    border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    borderRadius: 0, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
                    background: filterStatus === s ? 'var(--primary)' : 'transparent',
                    color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                    fontWeight: filterStatus === s ? 600 : 400,
                  }}
                  onClick={() => setFilterStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name, category, group or estate…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(search || filterCategoryID) && (
              <button id={`${ID}-btn-search-clear`} className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterCategoryID(''); }}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} workshops
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={modal === 'add' ? 'Add Workshop' : 'Edit Workshop'}
          subtitle={modal === 'add' ? 'Register a new vehicle maintenance workshop' : `Editing: ${modal.name}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          {/* Group & Estate */}
          <p className="section-label">Group & Estate</p>
          <GroupEstateFields
            idPrefix={ID}
            groupID={form.groupID}
            estateID={form.estateID}
            onChange={set}
            errors={errors}
          />

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* Workshop Details */}
          <p className="section-label">Workshop Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Workshop Category <span className="required">*</span></label>
              <select
                id={`${ID}-select-workshopCategoryID`}
                className={`form-control${errors.workshopCategoryID ? ' input-error' : ''}`}
                value={form.workshopCategoryID}
                onChange={e => set('workshopCategoryID', e.target.value)}
              >
                <option value="">— Select Category —</option>
                {workshopCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
              {errors.workshopCategoryID && <span className="field-error">{errors.workshopCategoryID}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Fixed Asset Type Serviced</label>
              <select
                id={`${ID}-select-fixedAssetTypeID`}
                className="form-control"
                value={form.fixedAssetTypeID}
                onChange={e => set('fixedAssetTypeID', e.target.value)}
              >
                <option value="">— None / All Types —</option>
                {assetTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                ))}
              </select>
              <span className="field-hint">Type of assets this workshop services</span>
            </div>

            <div className="form-group">
              <label className="form-label">Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. WS004"
              />
              {errors.code
                ? <span className="field-error">{errors.code}</span>
                : <span className="field-hint">Auto-generated — you may edit if needed</span>
              }
            </div>

            <div className="form-group">
              <label className="form-label">Workshop Name <span className="required">*</span></label>
              <input
                id={`${ID}-input-name`}
                className={`form-control${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. South Workshop"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                id={`${ID}-select-status`}
                className="form-control"
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          {(form.code || form.name) && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="building" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {form.name || 'Workshop name…'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {form.code || '—'}
                  {form.workshopCategoryID
                    ? ` · ${workshopCategories.find(c => c.id === Number(form.workshopCategoryID))?.name ?? ''}`
                    : ''}
                  {form.fixedAssetTypeID
                    ? ` · ${assetTypes.find(t => t.id === Number(form.fixedAssetTypeID))?.name ?? ''}`
                    : ''}
                  {form.estateID ? ` · ${nameOf.estate(Number(form.estateID))}` : ''}
                </p>
              </div>
              <span
                className={`badge ${STATUS_BADGE[form.status] ?? 'badge-neutral'}`}
                style={{ marginLeft: 'auto' }}
              >
                {form.status}
              </span>
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
                  <div className="card-header-title">Delete Workshop</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete workshop{' '}
                <strong>{confirmDelete.name}</strong>{' '}
                <span className="badge badge-neutral" style={{ verticalAlign: 'middle' }}>{confirmDelete.code}</span>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {nameOf.group(confirmDelete.groupID)} · {nameOf.estate(confirmDelete.estateID)}
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
