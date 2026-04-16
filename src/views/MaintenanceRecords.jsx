import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { maintenanceTaskStore }  from '../data/maintenanceTaskStore';
import { maintenanceRecordStore } from '../data/maintenanceRecordStore';
import { workshopStore } from '../data/workshopStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal }   from '../components/FormModal';
import { Icon }        from '../components/Icon';

const ID = 'mr';

/* Only Maintenance-type tasks can have records */
const MAINTENANCE_TASK_TYPE = 'Maintenance';

const EMPTY = { maintenanceTaskID: '', date: '', costOfService: '', description: '', items: [] };
const BLANK_ITEM = { skuID: '', quantity: '', unitCost: '', source: 'Workshop', itemIssueRef: '', hasRemovedItem: false, removedSkuID: '', removedQuantity: '', removedUnitCost: '' };

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function validate(form) {
  const e = {};
  if (!form.maintenanceTaskID) e.maintenanceTaskID = 'Maintenance task is required';
  if (!form.date)              e.date              = 'Date is required';
  if (form.costOfService === '' || form.costOfService == null) {
    e.costOfService = 'Cost of service is required';
  } else if (Number(form.costOfService) < 0) {
    e.costOfService = 'Cost must be 0 or greater';
  }
  if (!form.description.trim()) e.description = 'Description is required';
  return e;
}

export default function MaintenanceRecords() {
  const [data, setData]               = useState(() => maintenanceRecordStore.getAll());
  const [modal, setModal]             = useState(null);   // null | 'add' | row
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [filterTaskID, setFilterTaskID] = useState('');
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isAdd    = modal === 'add';
  const allWs    = workshopStore.getAll();

  /* Tasks of type Maintenance only */
  const maintenanceTasks = useMemo(
    () => maintenanceTaskStore.getAll().filter(t => t.taskType === MAINTENANCE_TASK_TYPE),
    [],
  );

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(r => {
    const task       = maintenanceTaskStore.getById(r.maintenanceTaskID);
    const vehicle    = task?.vehicleID    ? MOCK.vehicles.find(v => v.id === task.vehicleID)       : null;
    const fixedAsset = task?.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === task.fixedAssetID) : null;
    const _assetLabel = vehicle?.numbers ?? fixedAsset?.name ?? '—';
    const workshop   = allWs.find(w => w.id === task?.workshopID);
    return { ...r, _task: task, _vehicle: vehicle, _fixedAsset: fixedAsset, _assetLabel, _workshop: workshop };
  }), [data]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterTaskID) result = result.filter(r => r.maintenanceTaskID === Number(filterTaskID));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r._assetLabel?.toLowerCase().includes(q)    ||
        r._task?.refCode?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterTaskID, search]);

  /* ── Derived task for current form selection ── */
  const selectedTask    = form.maintenanceTaskID
    ? maintenanceTasks.find(t => t.id === Number(form.maintenanceTaskID))
    : null;
  const taskVehicle     = selectedTask?.vehicleID    ? MOCK.vehicles.find(v => v.id === selectedTask.vehicleID)       : null;
  const taskFixedAsset  = selectedTask?.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === selectedTask.fixedAssetID) : null;
  const taskAssetLabel  = taskVehicle?.numbers ?? taskFixedAsset?.name ?? '—';
  const taskWorkshop    = selectedTask ? allWs.find(w => w.id === selectedTask.workshopID) : null;

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const changeTask = (taskID) => {
    const task = maintenanceTasks.find(t => t.id === Number(taskID));
    setForm(f => ({
      ...f,
      maintenanceTaskID: taskID,
      date: f.date || task?.date || '',    // pre-fill date from task if blank
    }));
    setErrors(e => ({ ...e, maintenanceTaskID: undefined }));
  };

  /* ── Item management handlers ── */
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...BLANK_ITEM }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, key, val) => setForm(f => ({
    ...f,
    items: f.items.map((item, i) => i === idx ? { ...item, [key]: val } : item),
  }));

  const open = row => {
    setErrors({});
    setForm(row
      ? {
          maintenanceTaskID: row.maintenanceTaskID ?? '',
          date:              row.date              ?? '',
          costOfService:     row.costOfService     ?? '',
          description:       row.description       ?? '',
          items: (row.items ?? []).map(i => ({
            skuID: i.skuID ?? '', quantity: i.quantity ?? '', unitCost: i.unitCost ?? '',
            source: i.source ?? 'Workshop', itemIssueRef: i.itemIssueRef ?? '',
            hasRemovedItem: i.hasRemovedItem ?? false,
            removedSkuID: i.removedSkuID ?? '', removedQuantity: i.removedQuantity ?? '', removedUnitCost: i.removedUnitCost ?? '',
          })),
        }
      : EMPTY
    );
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const task = maintenanceTasks.find(t => t.id === Number(form.maintenanceTaskID));
    const payload = {
      maintenanceTaskID: Number(form.maintenanceTaskID),
      vehicleID:         task?.vehicleID  ?? 0,
      workshopID:        task?.workshopID ?? 0,
      date:              form.date,
      costOfService:     Number(form.costOfService),
      description:       form.description.trim(),
      items: form.items
        .filter(i => i.skuID && Number(i.quantity) > 0)
        .map(i => ({
          skuID: Number(i.skuID), quantity: Number(i.quantity), unitCost: Number(i.unitCost),
          source: i.source, itemIssueRef: i.itemIssueRef?.trim() ?? '',
          hasRemovedItem: !!i.hasRemovedItem,
          removedSkuID:    i.hasRemovedItem ? Number(i.removedSkuID) || '' : '',
          removedQuantity: i.hasRemovedItem ? Number(i.removedQuantity) || '' : '',
          removedUnitCost: i.hasRemovedItem ? Number(i.removedUnitCost) || 0 : 0,
        })),
    };
    if (isAdd) maintenanceRecordStore.add(payload);
    else       maintenanceRecordStore.update(modal.id, payload);
    setData(maintenanceRecordStore.getAll());
    close();
  };

  const del = () => {
    maintenanceRecordStore.remove(confirmDelete.id);
    setData(maintenanceRecordStore.getAll());
    setConfirmDelete(null);
  };

  /* Task for edit mode display */
  const editTask       = !isAdd && modal ? maintenanceTaskStore.getById(modal.maintenanceTaskID) : null;
  const editVehicle    = editTask?.vehicleID    ? MOCK.vehicles.find(v => v.id === editTask.vehicleID)       : null;
  const editFixedAsset = editTask?.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === editTask.fixedAssetID) : null;
  const editAssetLabel = editVehicle?.numbers ?? editFixedAsset?.name ?? '—';
  const editWorkshop   = editTask ? allWs.find(w => w.id === editTask.workshopID) : null;

  const isFilterActive = filterTaskID || search;

  /* ── Parts total ── */
  const partsTotal = form.items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unitCost) || 0), 0);

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Maintenance Records"
        subtitle="Detailed records for Maintenance-type tasks — repairs, servicing and inspections"
        columns={[
          {
            key: '_task',
            label: 'Task',
            render: v => v
              ? <span className="badge badge-neutral">{v.refCode}</span>
              : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>,
          },
          {
            key: 'date',
            label: 'Date',
            render: v => <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmtDate(v)}</span>,
          },
          {
            key: '_assetLabel',
            label: 'Asset',
            render: v => <strong style={{ fontSize: 13 }}>{v || '—'}</strong>,
          },
          {
            key: '_workshop',
            label: 'Workshop',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v?.name ?? '—'}</span>,
          },
          {
            key: 'description',
            label: 'Description',
            render: v => (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {v && v.length > 45 ? `${v.slice(0, 45)}…` : (v || '—')}
              </span>
            ),
          },
          {
            key: 'costOfService',
            label: 'Cost (Rs.)',
            render: v => (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Rs. {Number(v).toLocaleString()}
              </span>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="New Record"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: 220, marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-task`}
                className="form-control"
                value={filterTaskID}
                onChange={e => setFilterTaskID(e.target.value)}
              >
                <option value="">— All Tasks —</option>
                {maintenanceTasks.map(t => {
                  const v = t.vehicleID    ? MOCK.vehicles.find(vv => vv.id === t.vehicleID)     : null;
                  const a = t.fixedAssetID ? MOCK.fixedAssets.find(fa => fa.id === t.fixedAssetID) : null;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.refCode} — {fmtDate(t.date)} — {v?.numbers ?? a?.name ?? '—'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by task ref., asset or description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {isFilterActive && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setFilterTaskID(''); setSearch(''); }}
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
          title={isAdd ? 'New Maintenance Record' : 'Edit Maintenance Record'}
          subtitle={
            isAdd
              ? 'Log a maintenance or repair event under a Maintenance task'
              : `${editTask?.refCode ?? ''} — ${editAssetLabel} · ${fmtDate(modal.date)}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Section 1: Maintenance Task ── */}
          <p className="section-label">Maintenance Task <span className="required" style={{ fontWeight: 400 }}>*</span></p>

          {isAdd ? (
            <>
              <div className="form-group">
                <label className="form-label">Select Task <span className="required">*</span></label>
                <select
                  id={`${ID}-select-task`}
                  className={`form-control${errors.maintenanceTaskID ? ' input-error' : ''}`}
                  value={form.maintenanceTaskID}
                  onChange={e => changeTask(e.target.value)}
                >
                  <option value="">— Select Maintenance Task —</option>
                  {maintenanceTasks.map(t => {
                    const tv = t.vehicleID    ? MOCK.vehicles.find(v => v.id === t.vehicleID)       : null;
                    const ta = t.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === t.fixedAssetID) : null;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.refCode} — {fmtDate(t.date)} — {tv?.numbers ?? ta?.name ?? '—'}
                      </option>
                    );
                  })}
                </select>
                {errors.maintenanceTaskID
                  ? <span className="field-error">{errors.maintenanceTaskID}</span>
                  : <span className="field-hint">Only Maintenance-type tasks are listed</span>
                }
              </div>

              {/* Task info card (shown when task selected) */}
              {selectedTask && (
                <div style={{
                  padding: '10px 14px', marginTop: 4,
                  background: '#fef3c7', border: '1px solid #fde68a',
                  borderRadius: 'var(--radius-sm)',
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', marginBottom: 2 }}>Asset</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>
                      {taskAssetLabel}
                    </div>
                    {taskVehicle && <div style={{ fontSize: 11, color: '#92400e' }}>{taskVehicle.brand} {taskVehicle.model}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', marginBottom: 2 }}>Workshop</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{taskWorkshop?.name ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', marginBottom: 2 }}>Task Date</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{fmtDate(selectedTask.date)}</div>
                    <div style={{ fontSize: 11, color: '#92400e' }}>{selectedTask.mode}</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Edit mode — task locked */
            <div id={`${ID}-task-display`} style={{
              padding: '10px 14px',
              background: '#fef3c7', border: '1px solid #fde68a',
              borderRadius: 'var(--radius-sm)',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', marginBottom: 2 }}>Task</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{editTask?.refCode ?? '—'}</div>
                <div style={{ fontSize: 11, color: '#92400e' }}>{editTask?.mode}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', marginBottom: 2 }}>Asset</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{editAssetLabel}</div>
                {editVehicle && <div style={{ fontSize: 11, color: '#92400e' }}>{editVehicle.brand} {editVehicle.model}</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', marginBottom: 2 }}>Workshop</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{editWorkshop?.name ?? '—'}</div>
              </div>
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Section 2: Record Details ── */}
          <p className="section-label">Record Details</p>

          <div className="form-grid form-grid-2">
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
              <label className="form-label">Cost of Service (Rs.) <span className="required">*</span></label>
              <input
                id={`${ID}-input-cost`}
                type="number"
                min="0"
                step="0.01"
                className={`form-control${errors.costOfService ? ' input-error' : ''}`}
                value={form.costOfService}
                onChange={e => set('costOfService', e.target.value)}
                placeholder="e.g. 15000"
              />
              {errors.costOfService && <span className="field-error">{errors.costOfService}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description <span className="required">*</span></label>
            <textarea
              id={`${ID}-textarea-description`}
              className={`form-control${errors.description ? ' input-error' : ''}`}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Describe the maintenance work performed"
              rows={3}
            />
            {errors.description && <span className="field-error">{errors.description}</span>}
          </div>

          {/* ── Parts / SKUs Used ── */}
          <hr className="divider" style={{ margin: '16px 0' }} />
          <p className="section-label">
            Parts / SKUs Used <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
          </p>

          {form.items.map((item, idx) => {
            const rowTotal = Number(item.quantity) * Number(item.unitCost) || 0;
            return (
              <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 8, overflow: 'hidden' }}>
                {/* Main row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 96px 140px 76px 32px', gap: 6, padding: '6px 8px', alignItems: 'center', background: 'var(--bg-card)' }}>
                  <select id={`${ID}-item-${idx}-sku`} className="form-control" style={{ fontSize: 12, padding: '4px 6px' }} value={item.skuID} onChange={e => updateItem(idx, 'skuID', e.target.value)}>
                    <option value="">— SKU —</option>
                    {MOCK.skuMaster.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.unit})</option>)}
                  </select>
                  <input id={`${ID}-item-${idx}-qty`} type="number" min="1" className="form-control" style={{ fontSize: 12, padding: '4px 6px' }} value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" />
                  <input id={`${ID}-item-${idx}-cost`} type="number" min="0" step="0.01" className="form-control" style={{ fontSize: 12, padding: '4px 6px' }} value={item.unitCost} onChange={e => updateItem(idx, 'unitCost', e.target.value)} placeholder="Unit cost" />
                  <select id={`${ID}-item-${idx}-source`} className="form-control" style={{ fontSize: 12, padding: '4px 6px' }} value={item.source} onChange={e => updateItem(idx, 'source', e.target.value)}>
                    <option value="Workshop">From Workshop</option>
                    <option value="Direct">Direct (Item Issue)</option>
                  </select>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                    {rowTotal > 0 ? `Rs. ${rowTotal.toLocaleString()}` : '—'}
                  </span>
                  <button id={`${ID}-item-${idx}-remove`} type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                {/* Item Issue Ref (Direct source only) */}
                {item.source === 'Direct' && (
                  <div style={{ padding: '5px 8px 6px', borderTop: '1px solid var(--border)', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Item Issue Ref</span>
                    <input
                      id={`${ID}-item-${idx}-ref`}
                      className="form-control"
                      style={{ fontSize: 12, padding: '3px 6px', flex: 1 }}
                      value={item.itemIssueRef}
                      onChange={e => updateItem(idx, 'itemIssueRef', e.target.value)}
                      placeholder="e.g. ISS2627010001"
                    />
                  </div>
                )}

                {/* Removed / replaced item */}
                <div style={{ padding: '5px 8px 6px', borderTop: '1px solid var(--border)', background: item.hasRemovedItem ? '#fef9c3' : 'var(--bg-page)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: item.hasRemovedItem ? 6 : 0 }}>
                    <input
                      id={`${ID}-item-${idx}-has-removed`}
                      type="checkbox"
                      checked={!!item.hasRemovedItem}
                      onChange={e => updateItem(idx, 'hasRemovedItem', e.target.checked)}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Has removed / replaced item to return to workshop</span>
                  </label>
                  {item.hasRemovedItem && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 96px', gap: 6, marginLeft: 22 }}>
                      <select id={`${ID}-item-${idx}-removed-sku`} className="form-control" style={{ fontSize: 12, padding: '3px 6px' }} value={item.removedSkuID} onChange={e => updateItem(idx, 'removedSkuID', e.target.value)}>
                        <option value="">— Removed SKU —</option>
                        {MOCK.skuMaster.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                      </select>
                      <input id={`${ID}-item-${idx}-removed-qty`} type="number" min="1" className="form-control" style={{ fontSize: 12, padding: '3px 6px' }} value={item.removedQuantity} onChange={e => updateItem(idx, 'removedQuantity', e.target.value)} placeholder="Qty" />
                      <input id={`${ID}-item-${idx}-removed-cost`} type="number" min="0" step="0.01" className="form-control" style={{ fontSize: 12, padding: '3px 6px' }} value={item.removedUnitCost} onChange={e => updateItem(idx, 'removedUnitCost', e.target.value)} placeholder="Residual cost (0)" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button id={`${ID}-btn-add-item`} type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: form.items.length > 0 ? 4 : 0 }}>
            + Add Part / SKU
          </button>

          {partsTotal > 0 && (
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>Parts Total</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>Rs. {partsTotal.toLocaleString()}</span>
            </div>
          )}
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
                  <div className="card-header-title">Delete Record</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete maintenance record for{' '}
                <strong>{confirmDelete._assetLabel ?? '—'}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {confirmDelete._task?.refCode ?? '—'} &nbsp;·&nbsp;
                {fmtDate(confirmDelete.date)} &nbsp;·&nbsp;
                Rs. {Number(confirmDelete.costOfService).toLocaleString()}
              </p>
            </div>
            <div className="card-footer">
              <button
                id={`${ID}-btn-del-cancel`}
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                id={`${ID}-btn-del-confirm`}
                className="btn btn-danger"
                onClick={del}
              >
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
