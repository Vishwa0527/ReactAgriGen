import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { driverStore } from '../data/driverStore';
import { driverAssignmentStore } from '../data/driverAssignmentStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'da';

const EMPTY = { vehicleID: '', driverID: '', startDate: '', endDate: '', notes: '' };

const STATUS_BADGE = { Active: 'badge-success', Ended: 'badge-neutral' };

/* ── Validation ── */
function validate(form, editingID, allAssignments, allDrivers) {
  const e = {};
  if (!form.vehicleID) e.vehicleID = 'Vehicle is required';
  if (!form.driverID)  e.driverID  = 'Driver is required';
  if (!form.startDate) e.startDate = 'Start date is required';
  if (form.endDate && form.startDate && new Date(form.endDate) <= new Date(form.startDate))
    e.endDate = 'End date must be after start date';

  /* Active-assignment conflict — only relevant when end date is blank (open assignment) */
  if (!form.endDate) {
    const vConflict = allAssignments.find(
      a => a.vehicleID === Number(form.vehicleID) && !a.endDate && a.id !== editingID
    );
    if (vConflict) {
      const d = allDrivers.find(d => d.id === vConflict.driverID);
      e.vehicleID = `Already has an active assignment — ${d?.name ?? 'a driver'} since ${vConflict.startDate}`;
    }

    const dConflict = allAssignments.find(
      a => a.driverID === Number(form.driverID) && !a.endDate && a.id !== editingID
    );
    if (dConflict) {
      const v = MOCK.vehicles.find(v => v.id === dConflict.vehicleID);
      e.driverID = `Driver already assigned to ${v?.numbers ?? 'a vehicle'} since ${dConflict.startDate}`;
    }
  }

  return e;
}

export default function DriverAssignments() {
  const [data, setData]               = useState(() => driverAssignmentStore.getAll());
  const [modal, setModal]             = useState(null);   // null | 'add' | row
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [filterStatus, setFilterStatus] = useState('Active');
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* UI-only filter state (not persisted) */
  const [filterGroupID,  setFilterGroupID]  = useState('');
  const [filterEstateID, setFilterEstateID] = useState('');

  const isAdd      = modal === 'add';
  const allDrivers = driverStore.getAll();

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(a => {
    const vehicle = MOCK.vehicles.find(v => v.id === a.vehicleID);
    const driver  = allDrivers.find(d => d.id === a.driverID);
    const estate  = MOCK.estates.find(e => e.id === vehicle?.estateID);
    return {
      ...a,
      _vehicle: vehicle,
      _driver:  driver,
      _estate:  estate,
      _status:  a.endDate ? 'Ended' : 'Active',
    };
  }), [data]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterStatus !== 'All') result = result.filter(r => r._status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r._vehicle?.numbers?.toLowerCase().includes(q)                       ||
        `${r._vehicle?.brand} ${r._vehicle?.model}`.toLowerCase().includes(q) ||
        r._driver?.name?.toLowerCase().includes(q)                           ||
        r._driver?.code?.toLowerCase().includes(q)                           ||
        r._estate?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterStatus, search]);

  /* ── Modal filter-derived lists ── */
  const filteredEstates = filterGroupID
    ? MOCK.estates.filter(e => e.groupID === Number(filterGroupID))
    : MOCK.estates;

  const modalVehicles = MOCK.vehicles.filter(v => {
    if (filterEstateID) return v.estateID === Number(filterEstateID);
    if (filterGroupID)  return MOCK.estates.find(e => e.id === v.estateID)?.groupID === Number(filterGroupID);
    return true;
  });

  /* In Add mode: filter by estate. In Edit mode: all active drivers */
  const modalDrivers = allDrivers.filter(d => {
    if (d.status !== 'Active') return false;
    if (!isAdd) return true;
    const emp = MOCK.employees.find(e => e.id === d.employeeID);
    if (filterEstateID) return emp?.estateID === Number(filterEstateID);
    if (filterGroupID)  return MOCK.estates.find(e => e.id === emp?.estateID)?.groupID === Number(filterGroupID);
    return true;
  });

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

  const open = row => {
    setFilterGroupID('');
    setFilterEstateID('');
    setErrors({});
    setForm(row
      ? { vehicleID: row.vehicleID ?? '', driverID: row.driverID ?? '',
          startDate: row.startDate ?? '', endDate: row.endDate ?? '',
          notes: row.notes ?? '' }
      : EMPTY
    );
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const editingID = isAdd ? null : modal.id;
    const errs = validate(form, editingID, data, allDrivers);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      ...form,
      vehicleID: Number(form.vehicleID),
      driverID:  Number(form.driverID),
      endDate:   form.endDate || null,
    };
    if (isAdd) driverAssignmentStore.add(payload);
    else       driverAssignmentStore.update(modal.id, payload);
    setData(driverAssignmentStore.getAll());
    close();
  };

  const del = () => {
    driverAssignmentStore.remove(confirmDelete.id);
    setData(driverAssignmentStore.getAll());
    setConfirmDelete(null);
  };

  /* Selected previews in modal */
  const selectedVehicle = MOCK.vehicles.find(v => v.id === Number(form.vehicleID));
  const selectedDriver  = allDrivers.find(d => d.id === Number(form.driverID));
  const editVehicle     = !isAdd && modal ? MOCK.vehicles.find(v => v.id === modal.vehicleID) : null;
  const editVehicleEst  = editVehicle ? MOCK.estates.find(e => e.id === editVehicle.estateID) : null;

  /* Assignment duration (days) — shown when both dates are filled and valid */
  const assignmentDays = (() => {
    if (!form.startDate || !form.endDate) return null;
    const d = Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000);
    return d > 0 ? d : null;
  })();

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Driver Assignments"
        subtitle="Assign drivers to vehicles — track current and historical pairings per estate"
        columns={[
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
            key: '_estate',
            label: 'Estate',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v?.name ?? '—'}</span>,
          },
          {
            key: 'startDate',
            label: 'Start Date',
            render: v => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</span>,
          },
          {
            key: 'endDate',
            label: 'End Date',
            render: v => v
              ? <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</span>
              : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Open</span>,
          },
          {
            key: '_status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="New Assignment"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Status segmented filter */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
              {['All', 'Active', 'Ended'].map((s, i, arr) => (
                <button
                  key={s}
                  id={`${ID}-btn-status-${s.toLowerCase()}`}
                  style={{
                    border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    borderRadius: 0,
                    padding: '5px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                    background: filterStatus === s ? 'var(--primary)' : 'transparent',
                    color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                    fontWeight: filterStatus === s ? 600 : 400,
                    transition: 'background 0.15s',
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
                placeholder="Search by vehicle, driver or estate…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button id={`${ID}-btn-search-clear`} className="btn btn-secondary btn-sm"
                onClick={() => setSearch('')}>Clear</button>
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
          title={isAdd ? 'New Driver Assignment' : 'Edit Assignment'}
          subtitle={
            isAdd
              ? 'Assign a driver to a vehicle for a specific period'
              : `${editVehicle?.numbers ?? ''} — ${editVehicleEst?.name ?? ''}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Vehicle ── */}
          <p className="section-label">Vehicle</p>

          {isAdd ? (
            <>
              {/* Group / Estate filter */}
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
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
                  {modalVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.numbers} — {v.brand} {v.model}
                    </option>
                  ))}
                </select>
                {errors.vehicleID && <span className="field-error">{errors.vehicleID}</span>}
              </div>

              {/* Vehicle selection preview */}
              {selectedVehicle && (
                <div style={{
                  marginBottom: 4, padding: '8px 12px',
                  background: 'var(--bg-page)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
                }}>
                  <Icon name="car" style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="badge badge-primary">{selectedVehicle.numbers}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{selectedVehicle.brand} {selectedVehicle.model}</span>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {MOCK.estates.find(e => e.id === selectedVehicle.estateID)?.name ?? '—'}
                  </span>
                  <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>
                    {MOCK.vehicleTypes.find(t => t.id === selectedVehicle.vehicleTypeID)?.name ?? '—'}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Edit mode — vehicle read-only */
            <div
              id={`${ID}-vehicle-display`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: 'var(--bg-page)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Icon name="car" style={{ width: 18, height: 18, color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="badge badge-primary">{editVehicle?.numbers}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editVehicle?.brand} {editVehicle?.model}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                · {editVehicleEst?.name ?? '—'}
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

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Driver ── */}
          <p className="section-label">Driver</p>
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
                    {d.code} — {d.name}{isAdd && !filterEstateID ? ` (${est?.name ?? '—'})` : ''}
                  </option>
                );
              })}
            </select>
            {errors.driverID && <span className="field-error">{errors.driverID}</span>}
          </div>

          {/* Driver selection preview */}
          {selectedDriver && (
            <div style={{
              marginBottom: 4, padding: '8px 12px',
              background: 'var(--bg-page)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
            }}>
              <Icon name="user" style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="badge badge-neutral">{selectedDriver.code}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{selectedDriver.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {MOCK.licenseCategories.find(l => l.id === selectedDriver.licenseCategoryID)?.code} licence
              </span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Exp. {selectedDriver.licExpireDate}
              </span>
              <span
                className={`badge ${selectedDriver.status === 'Active' ? 'badge-success' : 'badge-warning'}`}
                style={{ marginLeft: 'auto' }}
              >
                {selectedDriver.status}
              </span>
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Assignment Period ── */}
          <p className="section-label">Assignment Period</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Start Date <span className="required">*</span></label>
              <input
                id={`${ID}-input-start-date`}
                type="date"
                className={`form-control${errors.startDate ? ' input-error' : ''}`}
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
              />
              {errors.startDate && <span className="field-error">{errors.startDate}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                id={`${ID}-input-end-date`}
                type="date"
                className={`form-control${errors.endDate ? ' input-error' : ''}`}
                value={form.endDate}
                onChange={e => set('endDate', e.target.value)}
              />
              {errors.endDate
                ? <span className="field-error">{errors.endDate}</span>
                : <span className="field-hint">Leave blank for an open (active) assignment</span>
              }
            </div>

            {/* Status + duration preview */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              Assignment status:
              <span className={`badge ${form.endDate ? 'badge-neutral' : 'badge-success'}`}>
                {form.endDate ? 'Ended' : 'Active'}
              </span>
              {assignmentDays !== null && (
                <span style={{ color: 'var(--text-muted)' }}>— {assignmentDays} days</span>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Notes</label>
            <textarea
              id={`${ID}-textarea-notes`}
              className="form-control"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional remarks about this assignment"
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
                  <div className="card-header-title">Remove Assignment</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Remove the assignment of{' '}
                <strong>{confirmDelete._driver?.name ?? `Driver #${confirmDelete.driverID}`}</strong>
                {' '}to vehicle{' '}
                <strong>{confirmDelete._vehicle?.numbers ?? `#${confirmDelete.vehicleID}`}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Period: {confirmDelete.startDate}
                {confirmDelete.endDate ? ` → ${confirmDelete.endDate}` : ' (Active)'}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={del}>
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
