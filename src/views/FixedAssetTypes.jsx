import { useState, useMemo } from 'react';
import { nameOf } from '../data/mockData';
import { fixedAssetTypeStore } from '../data/fixedAssetTypeStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { GroupEstateFields } from '../components/GroupEstateFields';
import { Icon } from '../components/Icon';

const ID = 'fat';

const EMPTY = { groupID: '', estateID: '', code: '', name: '', desc: '' };

function validate(form, editingID) {
  const e = {};
  if (!form.groupID)  e.groupID  = 'Group is required';
  if (!form.estateID) e.estateID = 'Estate is required';
  if (!form.code.trim()) {
    e.code = 'Code is required';
  } else if (!fixedAssetTypeStore.isCodeUnique(form.code.trim().toUpperCase(), editingID)) {
    e.code = 'This code is already in use';
  }
  if (!form.name.trim()) e.name = 'Asset Type Name is required';
  return e;
}

export default function FixedAssetTypes() {
  const [data, setData]               = useState(() => fixedAssetTypeStore.getAll());
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
      nameOf.group(r.groupID).toLowerCase().includes(q) ||
      nameOf.estate(r.estateID).toLowerCase().includes(q)
    );
  }, [data, search]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = (row) => {
    setForm(row
      ? { groupID: row.groupID ?? '', estateID: row.estateID ?? '', code: row.code, name: row.name, desc: row.desc ?? '' }
      : { ...EMPTY, code: fixedAssetTypeStore.nextCode() }
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
      code: form.code.trim().toUpperCase(),
      groupID: Number(form.groupID),
      estateID: Number(form.estateID),
    };
    if (modal === 'add') fixedAssetTypeStore.add(payload);
    else                 fixedAssetTypeStore.update(modal.id, payload);
    setData(fixedAssetTypeStore.getAll());
    close();
  };

  const del = () => {
    fixedAssetTypeStore.remove(confirmDelete.id);
    setData(fixedAssetTypeStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Fixed Asset Types"
        subtitle="Classify fixed assets for depreciation & accounting"
        columns={[
          { key: 'groupID',  label: 'Group',  render: v => nameOf.group(v) },
          { key: 'estateID', label: 'Estate', render: v => nameOf.estate(v) },
          { key: 'code',     label: 'Code',   render: v => <span className="badge badge-primary">{v}</span> },
          { key: 'name',     label: 'Asset Type Name' },
          { key: 'desc',     label: 'Description',
            render: v => v || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span> },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Asset Type"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name, group or estate…"
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
          title={modal === 'add' ? 'Add Fixed Asset Type' : 'Edit Fixed Asset Type'}
          subtitle={modal === 'add' ? 'Create a new fixed asset classification' : `Editing: ${modal.name}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          <p className="section-label">Group & Estate</p>
          <GroupEstateFields
            idPrefix={ID}
            groupID={form.groupID}
            estateID={form.estateID}
            onChange={set}
            errors={errors}
          />

          <hr className="divider" style={{ margin: '16px 0' }} />

          <p className="section-label">Asset Type Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Asset Type Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. FA004"
                maxLength={10}
              />
              {errors.code
                ? <span className="field-error">{errors.code}</span>
                : <span className="field-hint">Auto-generated — you may edit if needed</span>
              }
            </div>

            <div className="form-group">
              <label className="form-label">Asset Type Name <span className="required">*</span></label>
              <input
                id={`${ID}-input-name`}
                className={`form-control${errors.name ? ' input-error' : ''}`}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Motor Vehicle"
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
        </FormModal>
      )}

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div className="card fade-up" style={{ width:'100%', maxWidth:420 }}>
            <div className="card-header">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ width:36, height:36, borderRadius:'var(--radius-md)', background:'#fee2e2', color:'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon name="trash" style={{ width:17, height:17 }} />
                </span>
                <div>
                  <div className="card-header-title">Delete Fixed Asset Type</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize:14, color:'var(--text-primary)', lineHeight:1.7 }}>
                Delete <strong>{confirmDelete.name}</strong>{' '}
                <span className="badge badge-neutral" style={{ verticalAlign:'middle' }}>{confirmDelete.code}</span>?
              </p>
              <p style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>
                {nameOf.group(confirmDelete.groupID)} · {nameOf.estate(confirmDelete.estateID)}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={del}>
                <Icon name="trash" style={{ width:14, height:14 }} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
