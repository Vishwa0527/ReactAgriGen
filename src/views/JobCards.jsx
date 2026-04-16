import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { jobCardStore } from '../data/jobCardStore';
import { maintenanceTaskStore } from '../data/maintenanceTaskStore';
import { techAssignmentStore } from '../data/techAssignmentStore';
import { techCategoryStore } from '../data/techCategoryStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'jc';

const EMPTY = {
  maintenanceTaskID: '',
  employeeID:        '',
  startTime:         '',
  endTime:           '',
  description:       '',
  costOfService:     '',
};

/* ── Datetime helpers ── */
const toInput = dt => (dt ? dt.replace(' ', 'T') : '');
const toStore = dt => (dt ? dt.replace('T', ' ') : '');

function fmtDate(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt.replace(' ', 'T')).toLocaleDateString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dt; }
}

function fmtTime(dt) {
  if (!dt) return '—';
  return dt.split(/[ T]/)[1]?.slice(0, 5) ?? '—';
}

function calcDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end.replace(' ', 'T')) - new Date(start.replace(' ', 'T'));
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ── Validation ── */
function validate(form) {
  const e = {};
  if (!form.maintenanceTaskID)
    e.maintenanceTaskID = 'Maintenance task is required';
  if (!form.employeeID)
    e.employeeID = 'Technician is required';
  if (!form.startTime)
    e.startTime = 'Start time is required';
  if (!form.endTime) {
    e.endTime = 'End time is required';
  } else if (form.startTime && form.endTime) {
    const start = new Date(form.startTime.replace(' ', 'T'));
    const end   = new Date(form.endTime.replace(' ', 'T'));
    if (end <= start) e.endTime = 'End time must be after start time';
  }
  if (!form.description?.trim())
    e.description = 'Description is required';
  if (!form.costOfService || Number(form.costOfService) <= 0)
    e.costOfService = 'Enter a valid cost greater than 0';
  return e;
}

export default function JobCards() {
  const [data, setData]         = useState(() => jobCardStore.getAll());
  const [modal, setModal]       = useState(null);   // null | 'add' | row
  const [form, setForm]         = useState(EMPTY);
  const [errors, setErrors]     = useState({});
  const [filterTaskID, setFilterTaskID] = useState('');
  const [search, setSearch]     = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isAdd       = modal === 'add';
  const allTasks    = maintenanceTaskStore.getAll();
  const allAssignments = techAssignmentStore.getAll();
  const allCats     = techCategoryStore.getAll();

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(row => {
    const task       = allTasks.find(t => t.id === row.maintenanceTaskID);
    const vehicle    = task?.vehicleID    ? MOCK.vehicles.find(v => v.id === task.vehicleID)       : null;
    const fixedAsset = task?.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === task.fixedAssetID) : null;
    const _assetLabel = vehicle?.numbers ?? fixedAsset?.name ?? '—';
    const employee   = MOCK.employees.find(e => e.id === row.employeeID);
    const duration   = calcDuration(row.startTime, row.endTime);
    return { ...row, _task: task, _vehicle: vehicle, _fixedAsset: fixedAsset, _assetLabel, _employee: employee, _duration: duration };
  }), [data]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterTaskID)
      result = result.filter(r => r.maintenanceTaskID === Number(filterTaskID));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r._assetLabel?.toLowerCase().includes(q)         ||
        r._employee?.name?.toLowerCase().includes(q)     ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterTaskID, search]);

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = row => {
    setErrors({});
    setForm(row ? {
      maintenanceTaskID: row.maintenanceTaskID ?? '',
      employeeID:        row.employeeID        ?? '',
      startTime:         toInput(row.startTime) ?? '',
      endTime:           toInput(row.endTime)   ?? '',
      description:       row.description       ?? '',
      costOfService:     row.costOfService      ?? '',
    } : EMPTY);
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const task = allTasks.find(t => t.id === Number(form.maintenanceTaskID));
    const emp  = MOCK.employees.find(e => e.id === Number(form.employeeID));
    const payload = {
      ...form,
      maintenanceTaskID: Number(form.maintenanceTaskID),
      vehicleID:         task?.vehicleID   ?? null,
      workshopID:        task?.workshopID  ?? null,
      employeeID:        Number(form.employeeID),
      employeeName:      emp?.name ?? '',
      startTime:         toStore(form.startTime),
      endTime:           toStore(form.endTime),
      costOfService:     Number(form.costOfService),
    };
    if (isAdd) jobCardStore.add(payload);
    else       jobCardStore.update(modal.id, payload);
    setData(jobCardStore.getAll());
    close();
  };

  const del = () => {
    jobCardStore.remove(confirmDelete.id);
    setData(jobCardStore.getAll());
    setConfirmDelete(null);
  };

  /* Derived form values */
  const selectedTask       = allTasks.find(t => t.id === Number(form.maintenanceTaskID));
  const taskVehicle        = selectedTask?.vehicleID    ? MOCK.vehicles.find(v => v.id === selectedTask.vehicleID)       : null;
  const taskFixedAsset     = selectedTask?.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === selectedTask.fixedAssetID) : null;
  const taskAssetLabel     = taskVehicle?.numbers ?? taskFixedAsset?.name ?? '—';
  const taskWorkshop       = selectedTask ? MOCK.workshops?.find(w => w.id === selectedTask.workshopID) ?? { name: selectedTask.workshopName ?? '—' } : null;

  /* Edit mode: linked task */
  const editTask           = !isAdd && modal ? allTasks.find(t => t.id === modal.maintenanceTaskID) : null;
  const editTaskVehicle    = editTask?.vehicleID    ? MOCK.vehicles.find(v => v.id === editTask.vehicleID)       : null;
  const editTaskFixedAsset = editTask?.fixedAssetID ? MOCK.fixedAssets.find(a => a.id === editTask.fixedAssetID) : null;
  const editTaskAssetLabel = editTaskVehicle?.numbers ?? editTaskFixedAsset?.name ?? '—';

  /* Live duration preview (uses toInput-format times from form) */
  const liveDuration = calcDuration(
    form.startTime ? toStore(form.startTime) : '',
    form.endTime   ? toStore(form.endTime)   : '',
  );

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Work Orders"
        subtitle="Technician work orders — linked to service schedule tasks, tracked from start to completion"
        columns={[
          {
            key: '_task',
            label: 'Task',
            render: v => (
              <span className="badge badge-neutral">{v?.refCode ?? '—'}</span>
            ),
          },
          {
            key: '_assetLabel',
            label: 'Asset',
            render: v => (
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v || '—'}</strong>
            ),
          },
          {
            key: '_employee',
            label: 'Technician',
            render: v => (
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v?.name ?? '—'}</span>
            ),
          },
          {
            key: 'description',
            label: 'Description',
            render: v => (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {v && v.length > 40 ? `${v.slice(0, 40)}…` : (v || '—')}
              </span>
            ),
          },
          {
            key: '_duration',
            label: 'Duration',
            render: v => v ?? '—',
          },
          {
            key: 'costOfService',
            label: 'Cost (Rs.)',
            render: v => (
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                Rs. {Number(v).toLocaleString()}
              </strong>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Job Card"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Maintenance Task filter */}
            <div className="form-group" style={{ minWidth: 240, marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-task`}
                className="form-control"
                value={filterTaskID}
                onChange={e => setFilterTaskID(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— All Tasks —</option>
                {allTasks.map(t => {
                  const v = t.vehicleID    ? MOCK.vehicles.find(veh => veh.id === t.vehicleID)       : null;
                  const a = t.fixedAssetID ? MOCK.fixedAssets.find(fa => fa.id === t.fixedAssetID)   : null;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.refCode} — {v?.numbers ?? a?.name ?? '—'}
                    </option>
                  );
                })}
              </select>
            </div>
            {/* Search */}
            <div className="form-group" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by vehicle, technician or description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(search || filterTaskID) && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterTaskID(''); }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} job cards
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={isAdd ? 'Add Job Card' : 'Edit Job Card'}
          subtitle={
            isAdd
              ? 'Record a technician work order for a maintenance task'
              : `Editing job card — ${editTask?.refCode ?? `Task #${modal?.maintenanceTaskID}`}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Section 1: Maintenance Task ── */}
          <p className="section-label">Maintenance Task</p>

          {isAdd ? (
            <>
              <div className="form-group">
                <label className="form-label">Task <span className="required">*</span></label>
                <select
                  id={`${ID}-select-task`}
                  className={`form-control${errors.maintenanceTaskID ? ' input-error' : ''}`}
                  value={form.maintenanceTaskID}
                  onChange={e => set('maintenanceTaskID', e.target.value)}
                >
                  <option value="">— Select Task —</option>
                  {allTasks.map(t => {
                    const v = t.vehicleID    ? MOCK.vehicles.find(veh => veh.id === t.vehicleID)     : null;
                    const a = t.fixedAssetID ? MOCK.fixedAssets.find(fa => fa.id === t.fixedAssetID) : null;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.refCode} — {fmtDate(t.date)} — {v?.numbers ?? a?.name ?? '—'}
                      </option>
                    );
                  })}
                </select>
                {errors.maintenanceTaskID && (
                  <span className="field-error">{errors.maintenanceTaskID}</span>
                )}
              </div>

              {/* Task info card — shown when a task is selected */}
              {selectedTask && (
                <div style={{
                  marginTop: 10,
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 28, height: 28,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)',
                    color: 'var(--primary-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon name="settings" style={{ width: 13, height: 13 }} />
                  </div>
                  {/* Center info */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {selectedTask.refCode}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {fmtDate(selectedTask.date)}
                      {taskAssetLabel !== '—' ? ` · ${taskAssetLabel}` : ''}
                      {taskWorkshop ? ` · ${taskWorkshop.name}` : ''}
                    </p>
                  </div>
                  {/* Mode badge */}
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                  }}>
                    {selectedTask.mode ?? '—'}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Edit mode — read-only linked task card */
            <div
              id={`${ID}-task-display`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 16px',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{
                width: 40, height: 40,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name="settings" style={{ width: 18, height: 18 }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {editTask?.refCode ?? `Task #${modal?.maintenanceTaskID}`}
                </p>
                <p style={{ fontSize: 12, color: 'var(--primary-dark)' }}>
                  {editTask ? fmtDate(editTask.date) : ''}
                  {editTaskAssetLabel !== '—' ? ` · ${editTaskAssetLabel}` : ''}
                  {editTask?.workshopName ? ` · ${editTask.workshopName}` : ''}
                </p>
              </div>
              <span style={{
                fontSize: 11,
                color: 'var(--primary-dark)',
                padding: '3px 8px',
                background: 'rgba(255,255,255,0.6)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary)',
              }}>
                Linked Task
              </span>
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Section 2: Job Details ── */}
          <p className="section-label">Job Details</p>

          {/* Technician — full width above grid */}
          <div className="form-group">
            <label className="form-label">Technician <span className="required">*</span></label>
            <select
              id={`${ID}-select-technician`}
              className={`form-control${errors.employeeID ? ' input-error' : ''}`}
              value={form.employeeID}
              onChange={e => set('employeeID', e.target.value)}
            >
              <option value="">— Select Technician —</option>
              {allAssignments.map(a => {
                const emp = MOCK.employees.find(e => e.id === a.employeeID);
                const cat = allCats.find(c => c.id === a.techCategoryID);
                return (
                  <option key={a.id} value={a.employeeID}>
                    {emp?.employeeNo ?? '—'} — {emp?.name ?? '—'} ({cat?.name ?? '—'})
                  </option>
                );
              })}
            </select>
            {errors.employeeID && (
              <span className="field-error">{errors.employeeID}</span>
            )}
          </div>

          {/* Start / End Time grid */}
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Start Time <span className="required">*</span></label>
              <input
                id={`${ID}-input-start-time`}
                type="datetime-local"
                className={`form-control${errors.startTime ? ' input-error' : ''}`}
                style={{ width: '100%' }}
                value={form.startTime}
                onChange={e => set('startTime', e.target.value)}
              />
              {errors.startTime && (
                <span className="field-error">{errors.startTime}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">End Time <span className="required">*</span></label>
              <input
                id={`${ID}-input-end-time`}
                type="datetime-local"
                className={`form-control${errors.endTime ? ' input-error' : ''}`}
                value={form.endTime}
                onChange={e => set('endTime', e.target.value)}
              />
              {errors.endTime && (
                <span className="field-error">{errors.endTime}</span>
              )}
            </div>

            {/* Live duration preview */}
            {liveDuration && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingTop: 26,   /* align with field top */
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  ⏱ {liveDuration}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description <span className="required">*</span></label>
            <textarea
              id={`${ID}-textarea-description`}
              className={`form-control${errors.description ? ' input-error' : ''}`}
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Describe the work carried out…"
            />
            {errors.description && (
              <span className="field-error">{errors.description}</span>
            )}
          </div>

          {/* Cost of Service */}
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
              placeholder="e.g. 12000"
            />
            {errors.costOfService && (
              <span className="field-error">{errors.costOfService}</span>
            )}
          </div>
        </FormModal>
      )}

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.5)',
          zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: '#fee2e2',
                  color: 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Delete Job Card</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete job card for{' '}
                <strong>{confirmDelete._employee?.name ?? `Employee #${confirmDelete.employeeID}`}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {confirmDelete._task?.refCode ?? '—'}
                {' · '}
                {confirmDelete._vehicle?.numbers ?? '—'}
                {' · Rs. '}
                {Number(confirmDelete.costOfService).toLocaleString()}
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
