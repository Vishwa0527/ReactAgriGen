import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK } from '../data/mockData';
import { driverStore } from '../data/driverStore';
import { Icon } from '../components/Icon';

const ID = 'df';

const EMPTY = {
  employeeID:        '',
  code:              '',
  licenseNo:         '',
  licenseCategoryID: '',
  licExpireDate:     '',
  status:            'Active',
  notes:             '',
};

/* ── License expiry status ── */
function calcLicStatus(expireDate) {
  if (!expireDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expireDate);
  const daysLeft = Math.ceil((expiry - today) / 86400000);
  if (daysLeft < 0)   return { label: 'Expired',       cls: 'badge-danger',  days: daysLeft };
  if (daysLeft <= 30) return { label: 'Expiring Soon', cls: 'badge-warning', days: daysLeft };
  return                     { label: 'Valid',          cls: 'badge-success', days: daysLeft };
}

/* ── Validation ── */
function validate(form) {
  const e = {};
  if (!form.employeeID)         e.employeeID        = 'Employee is required';
  if (!form.code.trim())        e.code              = 'Driver code is required';
  if (!form.licenseNo.trim())   e.licenseNo         = 'License number is required';
  if (!form.licenseCategoryID)  e.licenseCategoryID = 'License category is required';
  if (!form.licExpireDate)      e.licExpireDate     = 'License expiry date is required';
  return e;
}

/* ── Reusable field wrapper ── */
function Field({ label, required, error, hint, span, children }) {
  return (
    <div className="form-group" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label className="form-label">
        {label}{required && <span className="required"> *</span>}
      </label>
      {children}
      {error
        ? <span className="field-error">{error}</span>
        : hint && <span className="field-hint">{hint}</span>
      }
    </div>
  );
}

export default function DriverForm() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isEdit   = Boolean(id);
  const existing = isEdit ? driverStore.getById(id) : null;

  /* ── Form state ── */
  const [form, setForm] = useState(() =>
    existing
      ? {
          employeeID:        existing.employeeID        ?? '',
          code:              existing.code              ?? '',
          licenseNo:         existing.licenseNo         ?? '',
          licenseCategoryID: existing.licenseCategoryID ?? '',
          licExpireDate:     existing.licExpireDate     ?? '',
          status:            existing.status            ?? 'Active',
          notes:             existing.notes             ?? '',
        }
      : { ...EMPTY, code: driverStore.nextCode() }
  );
  const [errors, setErrors] = useState({});

  /* ── UI-only filter state (not persisted to driver record) ── */
  const [filterGroupID,  setFilterGroupID]  = useState('');
  const [filterEstateID, setFilterEstateID] = useState('');

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === 'employeeID') next.licenseCategoryID = '';
      return next;
    });
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const changeGroup = (val) => {
    setFilterGroupID(val);
    setFilterEstateID('');
    set('employeeID', '');
  };

  const changeEstate = (val) => {
    setFilterEstateID(val);
    set('employeeID', '');
  };

  /* ── Derived data ── */
  const selectedEmployee = MOCK.employees.find(e => e.id === Number(form.employeeID));
  const linkedEmployee   = isEdit ? MOCK.employees.find(e => e.id === existing?.employeeID) : null;
  const licStatus        = calcLicStatus(form.licExpireDate);

  /* Estates filtered by selected group */
  const filteredEstates = filterGroupID
    ? MOCK.estates.filter(e => e.groupID === Number(filterGroupID))
    : MOCK.estates;

  /* Employees filtered by estate/group, designation Driver, not yet registered */
  const registeredEmpIDs = driverStore.getAll().map(d => d.employeeID);
  const availableEmployees = MOCK.employees.filter(e => {
    if (e.designation !== 'Driver') return false;
    if (e.status !== 'Active') return false;
    if (!isEdit && registeredEmpIDs.includes(e.id)) return false;
    if (filterEstateID) return e.estateID === Number(filterEstateID);
    if (filterGroupID) {
      const estate = MOCK.estates.find(est => est.id === e.estateID);
      return estate?.groupID === Number(filterGroupID);
    }
    return true;
  });

  /* ── Save ── */
  const handleSave = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const emp = MOCK.employees.find(e => e.id === Number(form.employeeID));
    const payload = {
      ...form,
      employeeID:        Number(form.employeeID),
      licenseCategoryID: Number(form.licenseCategoryID),
      name: emp?.name ?? '',
    };
    if (isEdit) driverStore.update(id, payload);
    else        driverStore.add(payload);
    navigate('/drivers');
  };

  /* ── Employee info card (shown when employee selected in add mode) ── */
  function EmployeeInfoCard({ emp }) {
    if (!emp) return null;
    const estate = MOCK.estates.find(e => e.id === emp.estateID);
    const group  = MOCK.groups.find(g => g.id === estate?.groupID);
    return (
      <div style={{
        marginTop: 12, padding: '14px 16px',
        background: 'var(--primary-light)', border: '1px solid var(--primary)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Employee Details (from AgriGEN ERP)
        </p>
        <div className="form-grid form-grid-3" style={{ gap: 8 }}>
          {[
            ['Employee No.',  emp.employeeNo],
            ['Full Name',     emp.name],
            ['NIC',           emp.nic],
            ['Designation',   emp.designation],
            ['Group',         group?.name  ?? '—'],
            ['Estate',        estate?.name ?? '—'],
            ['Mobile',        emp.mobile],
            ['Join Date',     emp.joinDate],
            ['ERP Status',    emp.status],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '6px 10px', background: 'var(--bg-card, #fff)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">

      {/* ── Page Title Bar ── */}
      <div className="page-title-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            id={`${ID}-btn-back`}
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/drivers')}
            style={{ gap: 4 }}
          >
            <Icon name="chevron" style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} />
            Back
          </button>
          <div>
            <h1 className="page-title">
              {isEdit ? `Edit Driver — ${existing?.code}` : 'Register New Driver'}
            </h1>
            <p className="page-subtitle">
              {isEdit
                ? `${existing?.name} · Update driver details`
                : 'Link an AgriGEN ERP employee (designation: Driver) and capture licence details'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Form Card ── */}
      <div className="card" style={{ maxWidth: 860 }}>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── Section 1: Employee from ERP ── */}
          <section>
            <p className="section-label">Employee (AgriGEN ERP)</p>

            {isEdit ? (
              /* Edit mode — read-only employee card */
              <div
                id={`${ID}-employee-display`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px',
                  background: 'var(--primary-light)', border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="user" style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {linkedEmployee?.name ?? `Employee #${existing?.employeeID}`}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--primary-dark)' }}>
                    {linkedEmployee?.employeeNo} &nbsp;·&nbsp;
                    NIC: {linkedEmployee?.nic} &nbsp;·&nbsp;
                    {(() => {
                      const estate = MOCK.estates.find(e => e.id === linkedEmployee?.estateID);
                      const group  = MOCK.groups.find(g => g.id === estate?.groupID);
                      return [group?.name, estate?.name].filter(Boolean).join(' › ');
                    })()}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--primary-dark)', padding: '3px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)' }}>
                  Linked Employee
                </span>
              </div>
            ) : (
              /* Add mode — Group → Estate → Employee cascade */
              <>
                {/* Filter row */}
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

                {/* Employee select — filtered by estate/group */}
                <Field label="Select Employee" required error={errors.employeeID}
                  hint={
                    filterEstateID
                      ? `Showing Driver-designated employees from ${MOCK.estates.find(e => e.id === Number(filterEstateID))?.name}`
                      : 'Select a Group and Estate above to narrow the list, or browse all available drivers'
                  }>
                  <select
                    id={`${ID}-select-employee`}
                    className={`form-control${errors.employeeID ? ' input-error' : ''}`}
                    value={form.employeeID}
                    onChange={e => set('employeeID', e.target.value)}
                  >
                    <option value="">— Select Employee —</option>
                    {availableEmployees.map(e => {
                      const estate = MOCK.estates.find(est => est.id === e.estateID);
                      return (
                        <option key={e.id} value={e.id}>
                          {e.employeeNo} — {e.name}{!filterEstateID ? ` (${estate?.name ?? '—'})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <EmployeeInfoCard emp={selectedEmployee} />
              </>
            )}
          </section>

          <hr className="divider" />

          {/* ── Section 2: License Details ── */}
          <section>
            <p className="section-label">Driving Licence Details</p>
            <div className="form-grid form-grid-2">

              <Field label="Licence Number" required error={errors.licenseNo}>
                <input
                  id={`${ID}-input-license-no`}
                  className={`form-control${errors.licenseNo ? ' input-error' : ''}`}
                  value={form.licenseNo}
                  onChange={e => set('licenseNo', e.target.value.toUpperCase())}
                  placeholder="e.g. B1234567"
                />
              </Field>

              <Field label="Licence Category" required error={errors.licenseCategoryID}>
                <select
                  id={`${ID}-select-license-category`}
                  className={`form-control${errors.licenseCategoryID ? ' input-error' : ''}`}
                  value={form.licenseCategoryID}
                  onChange={e => set('licenseCategoryID', e.target.value)}
                >
                  <option value="">— Select Category —</option>
                  {MOCK.licenseCategories.map(l => (
                    <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Licence Expiry Date" required error={errors.licExpireDate} span={2}>
                <input
                  id={`${ID}-input-lic-expiry`}
                  type="date"
                  className={`form-control${errors.licExpireDate ? ' input-error' : ''}`}
                  value={form.licExpireDate}
                  onChange={e => set('licExpireDate', e.target.value)}
                  style={{ maxWidth: 260 }}
                />
              </Field>

              {/* Live licence status preview */}
              {licStatus && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Licence status preview:
                  <span className={`badge ${licStatus.cls}`}>{licStatus.label}</span>
                  {licStatus.days >= 0
                    ? <span style={{ color: 'var(--text-muted)' }}>{licStatus.days} days remaining</span>
                    : <span style={{ color: 'var(--danger)' }}>{Math.abs(licStatus.days)} days overdue</span>
                  }
                </div>
              )}
            </div>
          </section>

          <hr className="divider" />

          {/* ── Section 3: Driver Details ── */}
          <section>
            <p className="section-label">Driver Details</p>
            <div className="form-grid form-grid-3">

              <Field label="Driver Code" required error={errors.code}
                hint={isEdit ? undefined : 'Auto-generated — you may edit if needed'}>
                <input
                  id={`${ID}-input-driver-code`}
                  className={`form-control${errors.code ? ' input-error' : ''}`}
                  value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. DRV005"
                />
              </Field>

              <Field label="Status">
                <select
                  id={`${ID}-select-status`}
                  className="form-control"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>

              <Field label="Notes" span={3}>
                <textarea
                  id={`${ID}-textarea-notes`}
                  className="form-control"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Optional remarks about this driver"
                  rows={2}
                />
              </Field>
            </div>
          </section>

        </div>

        {/* ── Form Footer ── */}
        <div className="card-footer">
          <button id={`${ID}-btn-cancel`} className="btn btn-secondary" onClick={() => navigate('/drivers')}>
            Cancel
          </button>
          <button id={`${ID}-btn-save`} className="btn btn-primary" onClick={handleSave}>
            <Icon name="check" />
            {isEdit ? 'Update Driver' : 'Register Driver'}
          </button>
        </div>
      </div>
    </div>
  );
}
