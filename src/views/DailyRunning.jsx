import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { driverStore } from '../data/driverStore';
import { driverAssignmentStore } from '../data/driverAssignmentStore';
import { dailyRunningStore } from '../data/dailyRunningStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'dr';

const EMPTY = {
  refCode: '', vehicleID: '', driverID: '',
  startDateTime: '', endDateTime: '',
  startOdo: '', endOdo: '', notes: '',
};

/* ── datetime helpers ── */
/* Storage format: 'YYYY-MM-DD HH:mm'  |  Input format: 'YYYY-MM-DDTHH:mm' */
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
  if (!form.refCode.trim())  e.refCode       = 'Reference code is required';
  if (!form.vehicleID)       e.vehicleID     = 'Vehicle is required';
  if (!form.driverID)        e.driverID      = 'Driver is required';
  if (!form.startDateTime)   e.startDateTime = 'Start date/time is required';
  if (!form.endDateTime) {
    e.endDateTime = 'End date/time is required';
  } else if (form.startDateTime &&
    new Date(form.endDateTime) <= new Date(form.startDateTime)) {
    e.endDateTime = 'End time must be after start time';
  }
  if (form.startOdo === '' || form.startOdo == null) {
    e.startOdo = 'Start odometer is required';
  } else if (Number(form.startOdo) < 0) {
    e.startOdo = 'Must be 0 or greater';
  }
  if (form.endOdo === '' || form.endOdo == null) {
    e.endOdo = 'End odometer is required';
  } else if (Number(form.endOdo) <= Number(form.startOdo)) {
    e.endOdo = 'End odometer must be greater than start odometer';
  }
  return e;
}

export default function DailyRunning() {
  const [data, setData]               = useState(() => dailyRunningStore.getAll());
  const [modal, setModal]             = useState(null);   // null | 'add' | row
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [filterDate, setFilterDate]   = useState('');
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* UI-only modal filters */
  const [filterGroupID,  setFilterGroupID]  = useState('');
  const [filterEstateID, setFilterEstateID] = useState('');

  const isAdd      = modal === 'add';
  const allDrivers = driverStore.getAll();

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(r => {
    const vehicle = MOCK.vehicles.find(v => v.id === r.vehicleID);
    const driver  = allDrivers.find(d => d.id === r.driverID);
    const dist    = r.startOdo != null && r.endOdo != null ? r.endOdo - r.startOdo : null;
    return {
      ...r,
      _vehicle:  vehicle,
      _driver:   driver,
      _dist:     dist,
      _duration: calcDuration(r.startDateTime, r.endDateTime),
    };
  }), [data]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterDate) result = result.filter(r => r.startDateTime?.startsWith(filterDate));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.refCode?.toLowerCase().includes(q)                                   ||
        r._vehicle?.numbers?.toLowerCase().includes(q)                         ||
        `${r._vehicle?.brand} ${r._vehicle?.model}`.toLowerCase().includes(q)  ||
        r._driver?.name?.toLowerCase().includes(q)                             ||
        r._driver?.code?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterDate, search]);

  /* ── Modal filter-derived lists ── */
  const filteredEstates = filterGroupID
    ? MOCK.estates.filter(e => e.groupID === Number(filterGroupID))
    : MOCK.estates;

  const modalVehicles = MOCK.vehicles.filter(v => {
    if (filterEstateID) return v.estateID === Number(filterEstateID);
    if (filterGroupID)  return MOCK.estates.find(e => e.id === v.estateID)?.groupID === Number(filterGroupID);
    return true;
  });

  const modalDrivers = allDrivers.filter(d => d.status === 'Active');

  /* ── Contextual hints ── */
  const lastOdo = form.vehicleID ? dailyRunningStore.getLastOdo(Number(form.vehicleID)) : null;

  const editRow    = !isAdd && modal ? modal : null;
  const editVehicle = editRow ? MOCK.vehicles.find(v => v.id === editRow.vehicleID) : null;

  /* ── Live preview computations ── */
  const previewDuration = calcDuration(
    toStore(form.startDateTime), toStore(form.endDateTime)
  );
  const previewDistance = (form.startOdo !== '' && form.endOdo !== '')
    ? Number(form.endOdo) - Number(form.startOdo)
    : null;

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const changeGroup = val => {
    setFilterGroupID(val);
    setFilterEstateID('');
    setForm(f => ({ ...f, vehicleID: '', driverID: '' }));
    setErrors(e => ({ ...e, vehicleID: undefined, driverID: undefined }));
  };

  const changeEstate = val => {
    setFilterEstateID(val);
    setForm(f => ({ ...f, vehicleID: '', driverID: '' }));
    setErrors(e => ({ ...e, vehicleID: undefined, driverID: undefined }));
  };

  const changeVehicle = val => {
    const next = { vehicleID: val, driverID: '', startOdo: '', endOdo: '' };
    /* Auto-suggest driver from active assignment */
    if (val) {
      const assignment = driverAssignmentStore.getActiveByVehicle(Number(val));
      if (assignment) next.driverID = String(assignment.driverID);
    }
    setForm(f => ({ ...f, ...next }));
    setErrors(e => ({ ...e, vehicleID: undefined, driverID: undefined, startOdo: undefined, endOdo: undefined }));
  };

  const open = row => {
    setFilterGroupID('');
    setFilterEstateID('');
    setErrors({});
    if (row) {
      setForm({
        refCode:       row.refCode       ?? '',
        vehicleID:     row.vehicleID     ?? '',
        driverID:      row.driverID      ?? '',
        startDateTime: toInput(row.startDateTime) ?? '',
        endDateTime:   toInput(row.endDateTime)   ?? '',
        startOdo:      row.startOdo      ?? '',
        endOdo:        row.endOdo        ?? '',
        notes:         row.notes         ?? '',
      });
    } else {
      setForm({ ...EMPTY, refCode: dailyRunningStore.nextRefCode() });
    }
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      ...form,
      vehicleID:     Number(form.vehicleID),
      driverID:      Number(form.driverID),
      startDateTime: toStore(form.startDateTime),
      endDateTime:   toStore(form.endDateTime),
      startOdo:      Number(form.startOdo),
      endOdo:        Number(form.endOdo),
    };
    if (isAdd) dailyRunningStore.add(payload);
    else       dailyRunningStore.update(modal.id, payload);
    setData(dailyRunningStore.getAll());
    close();
  };

  const del = () => {
    dailyRunningStore.remove(confirmDelete.id);
    setData(dailyRunningStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Daily Running"
        subtitle="Record per-trip odometer readings — one entry per vehicle trip"
        columns={[
          {
            key: 'refCode',
            label: 'Ref Code',
            render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
          },
          {
            key: '_vehicle',
            label: 'Vehicle',
            render: v => v ? (
              <span>
                <span className="badge badge-primary" style={{ marginRight: 6 }}>{v.numbers}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.brand} {v.model}</span>
              </span>
            ) : '—',
          },
          {
            key: '_driver',
            label: 'Driver',
            render: v => v ? (
              <span>
                <span className="badge badge-neutral" style={{ marginRight: 6 }}>{v.code}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</span>
              </span>
            ) : '—',
          },
          {
            key: 'startDateTime',
            label: 'Date',
            render: v => <span style={{ fontSize: 12 }}>{fmtDate(v)}</span>,
          },
          {
            key: 'startDateTime',
            label: 'Start → End',
            render: (v, row) => (
              <span style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {fmtTime(v)} → {fmtTime(row.endDateTime)}
              </span>
            ),
          },
          {
            key: '_duration',
            label: 'Duration',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v ?? '—'}</span>,
          },
          {
            key: '_dist',
            label: 'Distance',
            render: v => v != null
              ? <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('en-LK')} km</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="New Trip Record"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Date filter */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                id={`${ID}-input-date-filter`}
                type="date"
                className="form-control"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                title="Filter by trip date"
              />
            </div>
            {filterDate && (
              <button
                id={`${ID}-btn-date-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => setFilterDate('')}
              >
                Clear Date
              </button>
            )}
            {/* Search */}
            <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by ref code, vehicle or driver…"
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
          title={isAdd ? 'New Trip Record' : 'Edit Trip Record'}
          subtitle={
            isAdd
              ? 'Record a vehicle trip — odometer readings and schedule'
              : `${editRow?.refCode} — ${editVehicle?.numbers ?? ''} ${editVehicle?.brand ?? ''} ${editVehicle?.model ?? ''}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Section 1: Trip Reference ── */}
          <p className="section-label">Trip Reference</p>

          <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ref Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-ref-code`}
                className={`form-control${errors.refCode ? ' input-error' : ''}`}
                value={form.refCode}
                onChange={e => set('refCode', e.target.value.toUpperCase())}
                placeholder="e.g. DR-2026-001"
              />
              {errors.refCode && <span className="field-error">{errors.refCode}</span>}
            </div>
            <div /> {/* spacer */}
          </div>

          {/* Vehicle — Add: filter+select | Edit: read-only card */}
          {isAdd ? (
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
                  onChange={e => changeVehicle(e.target.value)}
                >
                  <option value="">— Select Vehicle —</option>
                  {modalVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.numbers} — {v.brand} {v.model}</option>
                  ))}
                </select>
                {errors.vehicleID && <span className="field-error">{errors.vehicleID}</span>}
              </div>
            </>
          ) : (
            <div
              id={`${ID}-vehicle-display`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
                padding: '10px 14px',
                background: 'var(--bg-page)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Icon name="car" style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="badge badge-primary">{editVehicle?.numbers}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editVehicle?.brand} {editVehicle?.model}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                · {MOCK.estates.find(e => e.id === editVehicle?.estateID)?.name ?? '—'}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)',
                padding: '2px 7px', background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              }}>
                Fixed
              </span>
            </div>
          )}

          {/* Driver select */}
          <div className="form-group">
            <label className="form-label">Driver <span className="required">*</span></label>
            <select
              id={`${ID}-select-driver`}
              className={`form-control${errors.driverID ? ' input-error' : ''}`}
              value={form.driverID}
              onChange={e => set('driverID', e.target.value)}
            >
              <option value="">— Select Driver —</option>
              {modalDrivers.map(d => {
                const emp = MOCK.employees.find(e => e.id === d.employeeID);
                const est = MOCK.estates.find(e => e.id === emp?.estateID);
                return (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name} ({est?.name ?? '—'})
                  </option>
                );
              })}
            </select>
            {errors.driverID
              ? <span className="field-error">{errors.driverID}</span>
              : isAdd && form.vehicleID && (() => {
                  const asgn = driverAssignmentStore.getActiveByVehicle(Number(form.vehicleID));
                  return asgn
                    ? <span className="field-hint">Auto-filled from active assignment — change if needed</span>
                    : <span className="field-hint" style={{ color: 'var(--warning, #d97706)' }}>No active assignment found for this vehicle</span>;
                })()
            }
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Section 2: Schedule ── */}
          <p className="section-label">Schedule</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Start Date & Time <span className="required">*</span></label>
              <input
                id={`${ID}-input-start-datetime`}
                type="datetime-local"
                className={`form-control${errors.startDateTime ? ' input-error' : ''}`}
                value={form.startDateTime}
                onChange={e => set('startDateTime', e.target.value)}
              />
              {errors.startDateTime && <span className="field-error">{errors.startDateTime}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">End Date & Time <span className="required">*</span></label>
              <input
                id={`${ID}-input-end-datetime`}
                type="datetime-local"
                className={`form-control${errors.endDateTime ? ' input-error' : ''}`}
                value={form.endDateTime}
                onChange={e => set('endDateTime', e.target.value)}
              />
              {errors.endDateTime && <span className="field-error">{errors.endDateTime}</span>}
            </div>

            {/* Duration preview */}
            {previewDuration && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Icon name="history" style={{ width: 13, height: 13 }} />
                Trip duration:
                <strong style={{ color: 'var(--text-primary)' }}>{previewDuration}</strong>
              </div>
            )}
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Section 3: Odometer ── */}
          <p className="section-label">Odometer Readings</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Start Odometer (km) <span className="required">*</span></label>
              <input
                id={`${ID}-input-start-odo`}
                type="number"
                min="0"
                step="1"
                className={`form-control${errors.startOdo ? ' input-error' : ''}`}
                value={form.startOdo}
                onChange={e => set('startOdo', e.target.value)}
                placeholder="e.g. 24500"
              />
              {errors.startOdo
                ? <span className="field-error">{errors.startOdo}</span>
                : lastOdo != null && (
                  <span className="field-hint">
                    Last recorded: <strong>{lastOdo.toLocaleString('en-LK')} km</strong>
                  </span>
                )
              }
            </div>

            <div className="form-group">
              <label className="form-label">End Odometer (km) <span className="required">*</span></label>
              <input
                id={`${ID}-input-end-odo`}
                type="number"
                min="0"
                step="1"
                className={`form-control${errors.endOdo ? ' input-error' : ''}`}
                value={form.endOdo}
                onChange={e => set('endOdo', e.target.value)}
                placeholder="e.g. 24780"
              />
              {errors.endOdo && <span className="field-error">{errors.endOdo}</span>}
            </div>

            {/* Distance preview */}
            {previewDistance != null && previewDistance > 0 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Icon name="route" style={{ width: 13, height: 13 }} />
                Distance covered:
                <strong style={{ color: 'var(--text-primary)' }}>
                  {previewDistance.toLocaleString('en-LK')} km
                </strong>
              </div>
            )}
            {previewDistance != null && previewDistance <= 0 && (
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--danger)' }}>
                End odometer must be greater than start odometer
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Notes</label>
            <textarea
              id={`${ID}-textarea-notes`}
              className="form-control"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional remarks about this trip"
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
                  <div className="card-header-title">Delete Trip Record</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete trip record{' '}
                <strong style={{ fontFamily: 'monospace' }}>{confirmDelete.refCode}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {confirmDelete._vehicle?.numbers} · {confirmDelete._driver?.name} ·{' '}
                {fmtDate(confirmDelete.startDateTime)}
                {confirmDelete._dist != null ? ` · ${confirmDelete._dist} km` : ''}
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
