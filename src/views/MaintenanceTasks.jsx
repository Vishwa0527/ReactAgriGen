import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { maintenanceTaskStore } from '../data/maintenanceTaskStore';
import { workshopStore } from '../data/workshopStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'mt';

const EMPTY = {
  refCode: '', date: '',
  fixedAssetTypeID: '', vehicleID: '', fixedAssetID: '',
  workshopID: '', mode: 'Scheduled', taskType: 'Maintenance',
  costTotal: '', notes: '',
};

const MODES = ['Scheduled', 'Preventive', 'Breakdown', 'Inspection'];

const MODE_STYLE = {
  Scheduled:  { background: 'var(--primary-light)', color: 'var(--primary-dark)', border: '1px solid var(--primary)' },
  Preventive: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  Breakdown:  { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  Inspection: { background: 'var(--bg-page)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
};

const TASK_TYPE_STYLE = {
  'Vehicle Service': { background: 'var(--primary-light)', color: 'var(--primary-dark)', border: '1px solid var(--primary)' },
  'Maintenance':     { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
};

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function validate(form, editingID) {
  const e = {};
  if (!form.refCode.trim()) {
    e.refCode = 'Reference code is required';
  } else if (!maintenanceTaskStore.isRefCodeUnique(form.refCode.trim().toUpperCase(), editingID)) {
    e.refCode = 'Reference code already exists';
  }
  if (!form.fixedAssetTypeID) e.fixedAssetTypeID = 'Asset type is required';
  if (!form.taskType)         e.taskType         = 'Task type is required';
  if (!form.date)             e.date             = 'Date is required';
  if (Number(form.fixedAssetTypeID) === 1) {
    if (!form.vehicleID)    e.vehicleID    = 'Vehicle is required';
  } else if (form.fixedAssetTypeID) {
    if (!form.fixedAssetID) e.fixedAssetID = 'Asset is required';
  }
  if (!form.workshopID) e.workshopID = 'Workshop is required';
  if (!form.mode)       e.mode       = 'Mode is required';
  if (form.costTotal === '' || form.costTotal == null) {
    e.costTotal = 'Cost total is required';
  } else if (Number(form.costTotal) < 0) {
    e.costTotal = 'Cost must be 0 or greater';
  }
  return e;
}

export default function MaintenanceTasks() {
  const [data, setData]               = useState(() => maintenanceTaskStore.getAll());
  const [modal, setModal]             = useState(null);   // null | 'add' | row
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [filterType, setFilterType]   = useState('');
  const [filterMode, setFilterMode]   = useState('');
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* UI-only modal filters (vehicle cascade) */
  const [filterGroupID,  setFilterGroupID]  = useState('');
  const [filterEstateID, setFilterEstateID] = useState('');

  const isAdd     = modal === 'add';
  const editingID = !isAdd && modal ? modal.id : null;
  const allWorkshops = workshopStore.getAll();

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(r => {
    const vehicle    = r.vehicleID    ? MOCK.vehicles.find(v => v.id === r.vehicleID)       : null;
    const fixedAsset = r.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === r.fixedAssetID) : null;
    const workshop   = allWorkshops.find(w => w.id === r.workshopID);
    const estate     = vehicle ? MOCK.estates.find(e => e.id === vehicle.estateID) : null;
    const _assetLabel = vehicle?.numbers ?? fixedAsset?.name ?? '—';
    return { ...r, _vehicle: vehicle, _fixedAsset: fixedAsset, _assetLabel, _workshop: workshop, _estate: estate };
  }), [data]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterType) result = result.filter(r => r.taskType === filterType);
    if (filterMode) result = result.filter(r => r.mode === filterMode);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.refCode?.toLowerCase().includes(q)          ||
        r._assetLabel?.toLowerCase().includes(q)      ||
        r._workshop?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterMode, filterType, search]);

  /* ── Modal filter-derived lists ── */
  const filteredEstates = filterGroupID
    ? MOCK.estates.filter(e => e.groupID === Number(filterGroupID))
    : MOCK.estates;

  const modalVehicles = MOCK.vehicles.filter(v => {
    if (filterEstateID) return v.estateID === Number(filterEstateID);
    if (filterGroupID)  return MOCK.estates.find(e => e.id === v.estateID)?.groupID === Number(filterGroupID);
    return true;
  });

  /* Fixed assets filtered by selected non-vehicle type */
  const modalFixedAssets = form.fixedAssetTypeID && Number(form.fixedAssetTypeID) !== 1
    ? MOCK.fixedAssets.filter(a => a.fixedAssetTypeID === Number(form.fixedAssetTypeID))
    : [];

  /* Workshops filtered by selected asset type */
  const modalWorkshops = allWorkshops.filter(w =>
    !form.fixedAssetTypeID || w.fixedAssetTypeID === Number(form.fixedAssetTypeID)
  );

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const changeAssetType = val => {
    setForm(f => ({
      ...f,
      fixedAssetTypeID: val,
      vehicleID:        '',
      fixedAssetID:     '',
      workshopID:       '',
      taskType:         Number(val) === 1 ? f.taskType : 'Maintenance',
    }));
    setFilterGroupID('');
    setFilterEstateID('');
    setErrors(e => ({ ...e, fixedAssetTypeID: undefined, vehicleID: undefined, fixedAssetID: undefined, workshopID: undefined }));
  };

  const changeGroup = val => {
    setFilterGroupID(val);
    setFilterEstateID('');
    setForm(f => ({ ...f, vehicleID: '' }));
    setErrors(e => ({ ...e, vehicleID: undefined }));
  };

  const changeEstate = val => {
    setFilterEstateID(val);
    setForm(f => ({ ...f, vehicleID: '' }));
    setErrors(e => ({ ...e, vehicleID: undefined }));
  };

  const open = row => {
    setFilterGroupID('');
    setFilterEstateID('');
    setErrors({});
    if (row) {
      setForm({
        refCode:          row.refCode          ?? '',
        date:             row.date             ?? '',
        fixedAssetTypeID: row.fixedAssetTypeID ?? '',
        vehicleID:        row.vehicleID        ?? '',
        fixedAssetID:     row.fixedAssetID     ?? '',
        workshopID:       row.workshopID       ?? '',
        mode:             row.mode             ?? 'Scheduled',
        taskType:         row.taskType         ?? 'Maintenance',
        costTotal:        row.costTotal        ?? '',
        notes:            row.notes            ?? '',
      });
    } else {
      setForm({ ...EMPTY, refCode: maintenanceTaskStore.nextRefCode() });
    }
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form, editingID);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const ws = modalWorkshops.find(w => w.id === Number(form.workshopID));
    const isVehicle = Number(form.fixedAssetTypeID) === 1;
    const payload = {
      ...form,
      refCode:          form.refCode.trim().toUpperCase(),
      fixedAssetTypeID: Number(form.fixedAssetTypeID),
      vehicleID:        isVehicle ? Number(form.vehicleID)    : null,
      fixedAssetID:     isVehicle ? null                      : Number(form.fixedAssetID),
      workshopID:       Number(form.workshopID),
      costTotal:        Number(form.costTotal),
      workshopName:     ws?.name ?? '',
    };
    if (isAdd) maintenanceTaskStore.add(payload);
    else       maintenanceTaskStore.update(modal.id, payload);
    setData(maintenanceTaskStore.getAll());
    close();
  };

  const del = () => {
    maintenanceTaskStore.remove(confirmDelete.id);
    setData(maintenanceTaskStore.getAll());
    setConfirmDelete(null);
  };

  const editVehicle    = !isAdd && modal?.vehicleID    ? MOCK.vehicles.find(v => v.id === modal.vehicleID)       : null;
  const editFixedAsset = !isAdd && modal?.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === modal.fixedAssetID) : null;
  const editAssetType  = !isAdd && modal ? MOCK.fixedAssetTypes.find(t => t.id === modal.fixedAssetTypeID) : null;

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Service Schedule"
        subtitle="Plan and schedule asset maintenance — scheduled, preventive, breakdown and inspections"
        columns={[
          {
            key: 'refCode',
            label: 'Ref Code',
            render: v => <span className="badge badge-neutral">{v}</span>,
          },
          {
            key: 'taskType',
            label: 'Type',
            render: v => (
              <span style={{
                ...(TASK_TYPE_STYLE[v] ?? {}),
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontWeight: 600,
                display: 'inline-block',
                whiteSpace: 'nowrap',
              }}>
                {v}
              </span>
            ),
          },
          {
            key: 'date',
            label: 'Date',
            render: v => <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmtDate(v)}</span>,
          },
          {
            key: '_assetLabel',
            label: 'Asset',
            render: v => (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v || '—'}</span>
            ),
          },
          {
            key: '_workshop',
            label: 'Workshop',
            render: v => v
              ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.name}</span>
              : '—',
          },
          {
            key: 'mode',
            label: 'Mode',
            render: v => (
              <span style={{
                ...MODE_STYLE[v],
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
              }}>
                {v}
              </span>
            ),
          },
          {
            key: 'costTotal',
            label: 'Cost Total',
            render: v => (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Rs. {Number(v).toLocaleString()}
              </span>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="New Task"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-type`}
                className="form-control"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <option value="">— All Types —</option>
                <option value="Vehicle Service">Vehicle Service</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-mode`}
                className="form-control"
                value={filterMode}
                onChange={e => setFilterMode(e.target.value)}
              >
                <option value="">— All Modes —</option>
                {MODES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by ref. code, asset or workshop…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(filterType || filterMode || search) && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setFilterType(''); setFilterMode(''); setSearch(''); }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} tasks
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={isAdd ? 'New Maintenance Task' : 'Edit Maintenance Task'}
          subtitle={
            isAdd
              ? 'Log a maintenance task — scheduled, preventive, breakdown or inspection'
              : `${modal.refCode} — ${editVehicle ? `${editVehicle.numbers} ${editVehicle.brand} ${editVehicle.model}` : (editFixedAsset?.name ?? editAssetType?.name ?? '')}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Task Type ── */}
          <div className="form-group">
            <label className="form-label">Task Type <span className="required">*</span></label>
            {isAdd ? (
              Number(form.fixedAssetTypeID) === 1 ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Vehicle Service', 'Maintenance'].map(type => (
                    <button
                      key={type}
                      id={`${ID}-modal-btn-type-${type.replace(' ', '-').toLowerCase()}`}
                      type="button"
                      style={{
                        flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 600,
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer',
                        background: form.taskType === type ? 'var(--primary)' : 'var(--bg-page)',
                        color:      form.taskType === type ? '#fff'           : 'var(--text-secondary)',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      onClick={() => set('taskType', type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  ...TASK_TYPE_STYLE['Maintenance'],
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Maintenance</span>
                  <span style={{ fontSize: 11, opacity: 0.75 }}>— set by asset type</span>
                </div>
              )
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                ...(TASK_TYPE_STYLE[form.taskType] ?? {}),
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{form.taskType}</span>
                <span style={{ fontSize: 11, opacity: 0.75 }}>— locked after creation</span>
              </div>
            )}
            {errors.taskType && <span className="field-error">{errors.taskType}</span>}
          </div>

          <hr className="divider" style={{ margin: '12px 0' }} />

          {/* ── Section 1: Task Info ── */}
          <p className="section-label">Task Info</p>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Ref Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-refcode`}
                className={`form-control${errors.refCode ? ' input-error' : ''}`}
                value={form.refCode}
                onChange={e => set('refCode', e.target.value)}
                placeholder="e.g. MT-007"
              />
              {errors.refCode
                ? <span className="field-error">{errors.refCode}</span>
                : <span className="field-hint">Auto-generated — you may edit if needed</span>
              }
            </div>

            <div className="form-group">
              <label className="form-label">Date <span className="required">*</span></label>
              <input
                id={`${ID}-input-date`}
                type="date"
                className={`form-control${errors.date ? ' input-error' : ''}`}
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
              {errors.date && <span className="field-error">{errors.date}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Mode <span className="required">*</span></label>
              <select
                id={`${ID}-select-mode`}
                className={`form-control${errors.mode ? ' input-error' : ''}`}
                value={form.mode}
                onChange={e => set('mode', e.target.value)}
              >
                {MODES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {errors.mode && <span className="field-error">{errors.mode}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Cost Total (Rs.) <span className="required">*</span></label>
              <input
                id={`${ID}-input-cost`}
                type="number"
                min="0"
                step="0.01"
                className={`form-control${errors.costTotal ? ' input-error' : ''}`}
                value={form.costTotal}
                onChange={e => set('costTotal', e.target.value)}
                placeholder="e.g. 15000"
              />
              {errors.costTotal && <span className="field-error">{errors.costTotal}</span>}
            </div>
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Section 2: Asset & Workshop ── */}
          <p className="section-label">Asset &amp; Workshop</p>

          {/* Asset Type selector */}
          <div className="form-group">
            <label className="form-label">Asset Type <span className="required">*</span></label>
            {isAdd ? (
              <select
                id={`${ID}-select-asset-type`}
                className={`form-control${errors.fixedAssetTypeID ? ' input-error' : ''}`}
                value={form.fixedAssetTypeID}
                onChange={e => changeAssetType(e.target.value)}
              >
                <option value="">— Select Asset Type —</option>
                {MOCK.fixedAssetTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : (
              <div style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-page)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              }}>
                {editAssetType?.name ?? '—'}
                <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>— locked after creation</span>
              </div>
            )}
            {errors.fixedAssetTypeID && <span className="field-error">{errors.fixedAssetTypeID}</span>}
          </div>

          {/* Asset picker — conditional on asset type */}
          {isAdd ? (
            Number(form.fixedAssetTypeID) === 1 ? (
              /* Motor Vehicle: group / estate / vehicle cascade */
              <>
                <div className="form-grid form-grid-2" style={{ marginBottom: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Group</label>
                    <select
                      id={`${ID}-select-filter-group`}
                      className="form-control"
                      value={filterGroupID}
                      onChange={e => changeGroup(e.target.value)}
                    >
                      <option value="">— All Groups —</option>
                      {MOCK.groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Estate</label>
                    <select
                      id={`${ID}-select-filter-estate`}
                      className="form-control"
                      value={filterEstateID}
                      onChange={e => changeEstate(e.target.value)}
                    >
                      <option value="">— All Estates —</option>
                      {filteredEstates.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle <span className="required">*</span></label>
                  <select
                    id={`${ID}-select-vehicle`}
                    className={`form-control${errors.vehicleID ? ' input-error' : ''}`}
                    value={form.vehicleID}
                    onChange={e => set('vehicleID', e.target.value)}
                  >
                    <option value="">— Select Vehicle —</option>
                    {modalVehicles.map(v => {
                      const est = MOCK.estates.find(e => e.id === v.estateID);
                      return (
                        <option key={v.id} value={v.id}>
                          {v.numbers} — {v.brand} {v.model}{!filterEstateID ? ` (${est?.name ?? '—'})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {errors.vehicleID && <span className="field-error">{errors.vehicleID}</span>}
                </div>
              </>
            ) : form.fixedAssetTypeID ? (
              /* Non-vehicle: fixed asset dropdown filtered by type */
              <div className="form-group">
                <label className="form-label">Fixed Asset <span className="required">*</span></label>
                <select
                  id={`${ID}-select-fixed-asset`}
                  className={`form-control${errors.fixedAssetID ? ' input-error' : ''}`}
                  value={form.fixedAssetID}
                  onChange={e => set('fixedAssetID', e.target.value)}
                >
                  <option value="">— Select Asset —</option>
                  {modalFixedAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                {errors.fixedAssetID && <span className="field-error">{errors.fixedAssetID}</span>}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Select an asset type above to choose the asset.
              </p>
            )
          ) : (
            /* Edit mode: read-only display */
            editVehicle ? (
              <div
                id={`${ID}-vehicle-display`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
                  padding: '10px 14px',
                  background: 'var(--primary-light)', border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Icon name="car" style={{ width: 16, height: 16, color: 'var(--primary-dark)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {editVehicle.numbers}
                </span>
                <span style={{ fontSize: 12, color: 'var(--primary-dark)', opacity: 0.8 }}>
                  {editVehicle.brand} {editVehicle.model} · Linked Vehicle
                </span>
              </div>
            ) : editFixedAsset ? (
              <div
                id={`${ID}-asset-display`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
                  padding: '10px 14px',
                  background: 'var(--primary-light)', border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Icon name="wrench" style={{ width: 16, height: 16, color: 'var(--primary-dark)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {editFixedAsset.code}
                </span>
                <span style={{ fontSize: 12, color: 'var(--primary-dark)', opacity: 0.8 }}>
                  {editFixedAsset.name} · Linked Asset
                </span>
              </div>
            ) : null
          )}

          <div className="form-group">
            <label className="form-label">Workshop <span className="required">*</span></label>
            <select
              id={`${ID}-select-workshop`}
              className={`form-control${errors.workshopID ? ' input-error' : ''}`}
              value={form.workshopID}
              onChange={e => set('workshopID', e.target.value)}
            >
              <option value="">— Select Workshop —</option>
              {modalWorkshops.map(w => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
            {errors.workshopID && <span className="field-error">{errors.workshopID}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              id={`${ID}-textarea-notes`}
              className="form-control"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional remarks about this maintenance task"
              rows={2}
            />
          </div>
        </FormModal>
      )}

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
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
                  <div className="card-header-title">Delete Task</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete maintenance task{' '}
                <strong style={{ fontFamily: 'monospace' }}>{confirmDelete.refCode}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {fmtDate(confirmDelete.date)} · {confirmDelete._assetLabel ?? '—'} · Rs. {confirmDelete.costTotal}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
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
