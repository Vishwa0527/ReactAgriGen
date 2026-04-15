import { useState, useMemo } from 'react';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'ft';

const EMPTY = { groupID: '', code: '', name: '', isSecondary: false, skuMasterID: '' };

function validate(form) {
  const e = {};
  if (!form.groupID)     e.groupID = 'Group is required';
  if (!form.code.trim()) e.code    = 'Code is required';
  if (!form.name.trim()) e.name    = 'Fuel Name is required';
  return e;
}

export default function FuelTypes() {
  const [data, setData]                   = useState(MOCK.fuelTypes);
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
      nameOf.group(r.groupID).toLowerCase().includes(q) ||
      (nameOf.sku(r.skuMasterID) || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = (row) => {
    setForm(row
      ? { groupID: row.groupID ?? '', code: row.code, name: row.name,
          isSecondary: row.isSecondary ?? false, skuMasterID: row.skuMasterID ?? '' }
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
      groupID:     Number(form.groupID),
      skuMasterID: form.skuMasterID ? Number(form.skuMasterID) : null,
    };
    if (modal === 'add') setData(d => [...d, { id: Date.now(), ...payload }]);
    else setData(d => d.map(r => r.id === modal.id ? { ...r, ...payload } : r));
    close();
  };

  const del = () => {
    setData(d => d.filter(r => r.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const selectedSku = MOCK.skuMaster.find(s => s.id === Number(form.skuMasterID));

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Fuel Types"
        subtitle="Primary and secondary fuel type definitions at group level"
        columns={[
          { key: 'groupID',     label: 'Group',      render: v => nameOf.group(v) },
          { key: 'code',        label: 'Code',        render: v => <span className="badge badge-primary">{v}</span> },
          { key: 'name',        label: 'Fuel Type Name' },
          {
            key: 'skuMasterID',
            label: 'SKU Code',
            render: v => {
              const sku = MOCK.skuMaster.find(s => s.id === v);
              return sku
                ? <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>{sku.code}</span>
                : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>;
            },
          },
          {
            key: 'isSecondary',
            label: 'Secondary',
            render: v => <span className={`badge ${v ? 'badge-info' : 'badge-neutral'}`}>{v ? 'Yes' : 'No'}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Fuel Type"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name, group or SKU code…"
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
          title={modal === 'add' ? 'Add Fuel Type' : 'Edit Fuel Type'}
          subtitle={modal === 'add' ? 'Define a new fuel type for a group' : `Editing: ${modal.name}`}
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
              {MOCK.groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            {errors.groupID && <span className="field-error">{errors.groupID}</span>}
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* Fuel details */}
          <p className="section-label">Fuel Type Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. DSL"
                maxLength={6}
              />
              {errors.code && <span className="field-error">{errors.code}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Fuel Name <span className="required">*</span></label>
              <input
                id={`${ID}-input-name`}
                className={`form-control${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Diesel"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            {/* SKU Master mapping — full width */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">SKU Code (Inventory)</label>
              <select
                id={`${ID}-select-sku`}
                className="form-control"
                value={form.skuMasterID}
                onChange={e => set('skuMasterID', e.target.value)}
              >
                <option value="">— Not linked to SKU —</option>
                {MOCK.skuMaster.map(s => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>

              {selectedSku ? (
                <div style={{
                  marginTop: 8, padding: '8px 12px',
                  background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 12, color: 'var(--primary-dark)',
                }}>
                  <Icon name="box" style={{ width: 14, height: 14, flexShrink: 0 }} />
                  <span>
                    <strong>{selectedSku.code}</strong> &nbsp;·&nbsp;
                    {selectedSku.name} &nbsp;·&nbsp;
                    Unit: <strong>{selectedSku.unit}</strong>
                  </span>
                </div>
              ) : (
                <span className="field-hint">Optional — link to the corresponding Inventory SKU for stock tracking</span>
              )}
            </div>

            {/* Is Secondary checkbox */}
            <div
              className="form-group"
              style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 10, display: 'flex' }}
            >
              <input
                id={`${ID}-checkbox-secondary`}
                type="checkbox"
                checked={form.isSecondary}
                onChange={e => set('isSecondary', e.target.checked)}
                style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <label htmlFor={`${ID}-checkbox-secondary`} style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Is Secondary Fuel Type
              </label>
              <span className="field-hint" style={{ marginTop: 0 }}>
                Check if used as a supplementary / secondary fuel
              </span>
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
                  <div className="card-header-title">Delete Fuel Type</div>
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
                {confirmDelete.skuMasterID && (
                  <> &nbsp;·&nbsp; SKU: {nameOf.sku(confirmDelete.skuMasterID)}</>
                )}
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
