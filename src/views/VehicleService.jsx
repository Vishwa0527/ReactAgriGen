import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { vehicleServiceStore } from '../data/vehicleServiceStore';
import { workshopStore } from '../data/workshopStore';
import { maintenanceTaskStore } from '../data/maintenanceTaskStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'vs';

const EMPTY = {
  vehicleID: '',
  workshopID: '',
  maintenanceTaskID: '',
  serviceDate: '',
  odometer: '',
  nextServiceDate: '',
  nextServiceOdo: '',
  costAmount: '',
  notes: '',
  items: [],   // [{skuID:'', quantity:'', unitCost:''}]
};

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function svcStatus(nextDate) {
  if (!nextDate) return null;
  const days = Math.ceil((new Date(nextDate) - new Date()) / 86400000);
  if (days < 0)   return { label: 'Overdue',  bg: '#fee2e2', color: '#991b1b', days: Math.abs(days) };
  if (days <= 30) return { label: 'Due Soon', bg: '#fef3c7', color: '#92400e', days };
  return               { label: 'On Track',  bg: '#dcfce7', color: '#166534', days };
}

function validate(form) {
  const e = {};
  if (!form.maintenanceTaskID) e.maintenanceTaskID = 'Maintenance task is required';
  if (!form.vehicleID)         e.vehicleID         = 'Vehicle is required';
  if (!form.workshopID)        e.workshopID        = 'Workshop is required';
  if (!form.serviceDate) e.serviceDate = 'Service date is required';

  if (form.odometer === '' || form.odometer == null) {
    e.odometer = 'Odometer reading is required';
  } else if (Number(form.odometer) < 0) {
    e.odometer = 'Odometer must be 0 or greater';
  }

  if (!form.nextServiceDate) {
    e.nextServiceDate = 'Next service date is required';
  } else if (form.serviceDate && form.nextServiceDate <= form.serviceDate) {
    e.nextServiceDate = 'Next service date must be after service date';
  }

  if (form.nextServiceOdo === '' || form.nextServiceOdo == null) {
    e.nextServiceOdo = 'Next service odometer is required';
  } else if (form.odometer !== '' && Number(form.nextServiceOdo) <= Number(form.odometer)) {
    e.nextServiceOdo = 'Next service odometer must be greater than current odometer';
  }

  if (form.costAmount === '' || form.costAmount == null) {
    e.costAmount = 'Cost amount is required';
  } else if (Number(form.costAmount) < 0) {
    e.costAmount = 'Cost must be 0 or greater';
  }

  return e;
}

export default function VehicleService() {
  const [data, setData]           = useState(() => vehicleServiceStore.getAll());
  const [modal, setModal]         = useState(null);   // null | 'add' | row
  const [form, setForm]           = useState(EMPTY);
  const [errors, setErrors]       = useState({});
  const [filterVehicleID, setFilterVehicleID] = useState('');
  const [search, setSearch]       = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isAdd     = modal === 'add';
  const editingID = !isAdd && modal ? modal.id : null;
  const allWorkshops = workshopStore.getAll();
  const allTasks     = maintenanceTaskStore.getAll();
  /* Only Vehicle Service-type tasks can have service records */
  const vsTasks      = allTasks.filter(t => t.taskType === 'Vehicle Service');

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(r => {
    const vehicle  = MOCK.vehicles.find(v => v.id === r.vehicleID);
    const workshop = allWorkshops.find(w => w.id === r.workshopID);
    const estate   = vehicle ? MOCK.estates.find(e => e.id === vehicle.estateID) : null;
    const status   = svcStatus(r.nextServiceDate);
    return { ...r, _vehicle: vehicle, _workshop: workshop, _estate: estate, _status: status };
  }), [data]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterVehicleID) result = result.filter(r => r.vehicleID === Number(filterVehicleID));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r._vehicle?.numbers?.toLowerCase().includes(q)                          ||
        `${r._vehicle?.brand} ${r._vehicle?.model}`.toLowerCase().includes(q)  ||
        r._workshop?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterVehicleID, search]);

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  /* When a task is selected, auto-populate vehicle + workshop */
  const changeTask = (taskID) => {
    const task = vsTasks.find(t => t.id === Number(taskID));
    setForm(f => ({
      ...f,
      maintenanceTaskID: taskID,
      vehicleID:  task?.vehicleID  ?? '',
      workshopID: task?.workshopID ?? '',
    }));
    setErrors(e => ({ ...e, maintenanceTaskID: undefined, vehicleID: undefined }));
  };

  /* ── Item management handlers ── */
  const BLANK_ITEM = { skuID: '', quantity: '', unitCost: '', source: 'Workshop', itemIssueRef: '', hasRemovedItem: false, removedSkuID: '', removedQuantity: '', removedUnitCost: '' };
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...BLANK_ITEM }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, key, val) => setForm(f => ({
    ...f,
    items: f.items.map((item, i) => i === idx ? { ...item, [key]: val } : item),
  }));

  const open = row => {
    setErrors({});
    if (row) {
      setForm({
        vehicleID:         row.vehicleID         ?? '',
        workshopID:        row.workshopID        ?? '',
        maintenanceTaskID: row.maintenanceTaskID ?? '',
        serviceDate:       row.serviceDate       ?? '',
        odometer:          row.odometer          ?? '',
        nextServiceDate:   row.nextServiceDate   ?? '',
        nextServiceOdo:    row.nextServiceOdo    ?? '',
        costAmount:        row.costAmount        ?? '',
        notes:             row.notes             ?? '',
        items: (row.items ?? []).map(i => ({
          skuID: i.skuID ?? '', quantity: i.quantity ?? '', unitCost: i.unitCost ?? '',
          source: i.source ?? 'Workshop', itemIssueRef: i.itemIssueRef ?? '',
          hasRemovedItem: i.hasRemovedItem ?? false,
          removedSkuID: i.removedSkuID ?? '', removedQuantity: i.removedQuantity ?? '', removedUnitCost: i.removedUnitCost ?? '',
        })),
      });
    } else {
      setForm({ ...EMPTY });
    }
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const ws = allWorkshops.find(w => w.id === Number(form.workshopID));
    const payload = {
      ...form,
      vehicleID:         Number(form.vehicleID),
      workshopID:        Number(form.workshopID),
      maintenanceTaskID: Number(form.maintenanceTaskID),
      odometer:          Number(form.odometer),
      nextServiceOdo:    Number(form.nextServiceOdo),
      costAmount:        Number(form.costAmount),
      workshopName:      ws?.name ?? '',
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
    if (isAdd) vehicleServiceStore.add(payload);
    else       vehicleServiceStore.update(modal.id, payload);
    setData(vehicleServiceStore.getAll());
    close();
  };

  const del = () => {
    vehicleServiceStore.remove(confirmDelete.id);
    setData(vehicleServiceStore.getAll());
    setConfirmDelete(null);
  };

  /* ── Last-service hint for selected vehicle ── */
  const lastService = form.vehicleID
    ? vehicleServiceStore.getLastByVehicle(Number(form.vehicleID))
    : null;

  /* ── Live status preview for form ── */
  const formStatus = form.nextServiceDate ? svcStatus(form.nextServiceDate) : null;

  /* ── Task / vehicle derived for form display ── */
  const selectedTask    = form.maintenanceTaskID
    ? vsTasks.find(t => t.id === Number(form.maintenanceTaskID))
    : null;
  const formVehicle     = form.vehicleID ? MOCK.vehicles.find(v => v.id === Number(form.vehicleID)) : null;
  const editVehicle     = !isAdd && modal ? MOCK.vehicles.find(v => v.id === modal.vehicleID) : null;

  /* ── Parts total (must be before JSX return) ── */
  const partsTotal = form.items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unitCost) || 0), 0);

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Vehicle Service"
        subtitle="Track scheduled vehicle services — next service dates, odometer targets and workshop history"
        columns={[
          {
            key: '_vehicle',
            label: 'Vehicle',
            render: v => (
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  {v?.numbers ?? '—'}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  {v ? `${v.brand} ${v.model}` : ''}
                </p>
              </div>
            ),
          },
          {
            key: 'serviceDate',
            label: 'Service Date',
            render: v => (
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmtDate(v)}</span>
            ),
          },
          {
            key: 'odometer',
            label: 'Odometer',
            render: v => (
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {Number(v).toLocaleString()} km
              </span>
            ),
          },
          {
            key: '_workshop',
            label: 'Workshop',
            render: v => (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v?.name ?? '—'}</span>
            ),
          },
          {
            key: 'nextServiceDate',
            label: 'Next Service',
            render: v => {
              const st = svcStatus(v);
              return (
                <div>
                  <span style={{ fontSize: 13 }}>{fmtDate(v)}</span>
                  {st && (
                    <span style={{
                      background: st.bg,
                      color: st.color,
                      marginLeft: 6,
                      padding: '1px 7px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {st.label}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: 'costAmount',
            label: 'Cost (Rs.)',
            render: v => (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Rs. {Number(v).toLocaleString()}
              </span>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="New Service"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-vehicle`}
                className="form-control"
                value={filterVehicleID}
                onChange={e => setFilterVehicleID(e.target.value)}
              >
                <option value="">— All Vehicles —</option>
                {MOCK.vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.numbers} — {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by vehicle or workshop…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(filterVehicleID || search) && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setFilterVehicleID(''); setSearch(''); }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} service records
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={isAdd ? 'New Service Record' : 'Edit Service Record'}
          subtitle={
            isAdd
              ? 'Log a vehicle service — workshop, odometer readings and next service schedule'
              : `${editVehicle?.numbers ?? ''} ${editVehicle?.brand ?? ''} ${editVehicle?.model ?? ''} · ${fmtDate(modal.serviceDate)}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Section 1: Maintenance Task (required) ── */}
          <p className="section-label">Maintenance Task <span className="required">*</span></p>

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
                  {vsTasks.map(t => {
                    const tv = MOCK.vehicles.find(v => v.id === t.vehicleID);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.refCode} — {fmtDate(t.date)} — {tv?.numbers ?? '—'}
                      </option>
                    );
                  })}
                </select>
                {errors.maintenanceTaskID
                  ? <span className="field-error">{errors.maintenanceTaskID}</span>
                  : <span className="field-hint">Only Vehicle Service-type tasks are listed</span>
                }
              </div>

              {/* Task + vehicle info card (shown when a task is selected) */}
              {selectedTask && formVehicle && (
                <div style={{
                  padding: '10px 14px', marginTop: 4,
                  background: 'var(--primary-light)', border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: 2 }}>Vehicle</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{formVehicle.numbers}</div>
                    <div style={{ fontSize: 11, color: 'var(--primary-dark)', opacity: 0.8 }}>{formVehicle.brand} {formVehicle.model}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: 2 }}>Task</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{selectedTask.refCode}</div>
                    <div style={{ fontSize: 11, color: 'var(--primary-dark)', opacity: 0.8 }}>{selectedTask.mode}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: 2 }}>Task Date</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{fmtDate(selectedTask.date)}</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Edit mode — task locked */
            <div id={`${ID}-task-display`} style={{
              padding: '10px 14px',
              background: 'var(--primary-light)', border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-sm)',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: 2 }}>Vehicle</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{editVehicle?.numbers ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--primary-dark)', opacity: 0.8 }}>{editVehicle?.brand} {editVehicle?.model}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: 2 }}>Task</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {allTasks.find(t => t.id === modal.maintenanceTaskID)?.refCode ?? '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-dark)', textTransform: 'uppercase', marginBottom: 2 }}>Task Date</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {fmtDate(allTasks.find(t => t.id === modal.maintenanceTaskID)?.date)}
                </div>
              </div>
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Section 2: Workshop ── */}
          <p className="section-label">Workshop</p>

          {/* Last service hint */}
          {form.vehicleID && lastService && (
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', marginBottom: 10,
              padding: '4px 10px',
              background: 'var(--bg-page)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              Last service: {fmtDate(lastService.serviceDate)} at {Number(lastService.odometer).toLocaleString()} km
            </div>
          )}

          {/* Workshop select */}
          <div className="form-group">
            <label className="form-label">Workshop <span className="required">*</span></label>
            <select
              id={`${ID}-select-workshop`}
              className={`form-control${errors.workshopID ? ' input-error' : ''}`}
              value={form.workshopID}
              onChange={e => set('workshopID', e.target.value)}
            >
              <option value="">— Select Workshop —</option>
              {allWorkshops.map(w => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
            {errors.workshopID
              ? <span className="field-error">{errors.workshopID}</span>
              : <span className="field-hint">Pre-filled from task — change if service is at a different location</span>
            }
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Section 3: Service Details ── */}
          <p className="section-label">Service Details</p>

          <div className="form-grid form-grid-2">
            {/* Row 1: Service Date + Odometer */}
            <div className="form-group">
              <label className="form-label">Service Date <span className="required">*</span></label>
              <input
                id={`${ID}-input-service-date`}
                type="date"
                className={`form-control${errors.serviceDate ? ' input-error' : ''}`}
                value={form.serviceDate}
                onChange={e => set('serviceDate', e.target.value)}
              />
              {errors.serviceDate && <span className="field-error">{errors.serviceDate}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Odometer (km) <span className="required">*</span></label>
              <input
                id={`${ID}-input-odometer`}
                type="number"
                min="0"
                className={`form-control${errors.odometer ? ' input-error' : ''}`}
                value={form.odometer}
                onChange={e => set('odometer', e.target.value)}
                placeholder="e.g. 24780"
              />
              {errors.odometer
                ? <span className="field-error">{errors.odometer}</span>
                : <span className="field-hint">Current odometer reading in km</span>
              }
            </div>

            {/* Row 2: Next Service Date + Next Service Odo */}
            <div className="form-group">
              <label className="form-label">Next Service Date <span className="required">*</span></label>
              <input
                id={`${ID}-input-next-date`}
                type="date"
                className={`form-control${errors.nextServiceDate ? ' input-error' : ''}`}
                value={form.nextServiceDate}
                onChange={e => set('nextServiceDate', e.target.value)}
              />
              {errors.nextServiceDate && <span className="field-error">{errors.nextServiceDate}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Next Service Odometer (km) <span className="required">*</span></label>
              <input
                id={`${ID}-input-next-odo`}
                type="number"
                min="0"
                className={`form-control${errors.nextServiceOdo ? ' input-error' : ''}`}
                value={form.nextServiceOdo}
                onChange={e => set('nextServiceOdo', e.target.value)}
                placeholder="e.g. 30000"
              />
              {errors.nextServiceOdo
                ? <span className="field-error">{errors.nextServiceOdo}</span>
                : <span className="field-hint">Odometer at next service</span>
              }
            </div>

            {/* Live next-service status preview */}
            {formStatus && (
              <div style={{
                gridColumn: '1 / -1',
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: formStatus.bg,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontWeight: 700, color: formStatus.color, fontSize: 13 }}>
                  {formStatus.label}
                </span>
                <span style={{ fontSize: 12, color: formStatus.color }}>
                  {formStatus.label === 'Overdue'
                    ? `${formStatus.days} days overdue`
                    : formStatus.days === 0
                      ? 'Due today'
                      : `${formStatus.days} days remaining`
                  }
                </span>
              </div>
            )}

            {/* Row 3: Cost Amount (full width) */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Cost Amount (Rs.) <span className="required">*</span></label>
              <input
                id={`${ID}-input-cost`}
                type="number"
                min="0"
                step="0.01"
                className={`form-control${errors.costAmount ? ' input-error' : ''}`}
                value={form.costAmount}
                onChange={e => set('costAmount', e.target.value)}
                placeholder="e.g. 15000"
              />
              {errors.costAmount && <span className="field-error">{errors.costAmount}</span>}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Notes</label>
            <textarea
              id={`${ID}-textarea-notes`}
              className="form-control"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional remarks about this service"
              rows={2}
            />
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

          {/* Column hint (shown when items exist) */}
          {form.items.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 96px 140px 76px 32px', gap: 6, padding: '0 8px 4px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              <span>SKU / Item</span><span>Qty</span><span>Unit Cost</span><span>Source</span><span style={{ textAlign: 'right' }}>Total</span><span />
            </div>
          )}

          <button id={`${ID}-btn-add-item`} type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: form.items.length > 0 ? 4 : 0 }}>
            + Add Part / SKU
          </button>

          {/* Parts total */}
          {partsTotal > 0 && (
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Parts Total: <span style={{ color: 'var(--primary-dark)', marginLeft: 8, fontWeight: 700 }}>Rs. {partsTotal.toLocaleString()}</span>
            </div>
          )}

          {/* Grand total summary */}
          {(partsTotal > 0 || form.costAmount) && (
            <div style={{
              marginTop: 12, padding: '8px 14px',
              background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: 'var(--primary-dark)', fontWeight: 600 }}>Estimated Total (Service + Parts)</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-dark)' }}>
                Rs. {(Number(form.costAmount || 0) + partsTotal).toLocaleString()}
              </span>
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
                  <div className="card-header-title">Delete Service Record</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete service record for{' '}
                <strong>{confirmDelete._vehicle?.numbers}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {fmtDate(confirmDelete.serviceDate)} · {confirmDelete._workshop?.name ?? '—'} · Rs. {Number(confirmDelete.costAmount).toLocaleString()}
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
