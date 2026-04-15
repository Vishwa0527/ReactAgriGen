import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { techCategoryStore } from '../data/techCategoryStore';
import { techAssignmentStore } from '../data/techAssignmentStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'ta';

const EMPTY = { employeeID: '', techCategoryID: '', notes: '' };

/* ── Validation ── */
function validate(form, editingID) {
  const e = {};
  if (!form.employeeID)     e.employeeID     = 'Employee is required';
  if (!form.techCategoryID) e.techCategoryID = 'Technician category is required';
  if (form.employeeID && techAssignmentStore.isEmployeeAssigned(Number(form.employeeID), editingID))
    e.employeeID = 'This employee is already registered as a technician';
  return e;
}

export default function TechAssignments() {
  const [data, setData]               = useState(() => techAssignmentStore.getAll());
  const [modal, setModal]             = useState(null);   // null | 'add' | row
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [filterCatID, setFilterCatID] = useState('');
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* UI-only modal filters */
  const [filterGroupID,  setFilterGroupID]  = useState('');
  const [filterEstateID, setFilterEstateID] = useState('');

  const isAdd      = modal === 'add';
  const allCats    = techCategoryStore.getAll();

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(a => {
    const emp    = MOCK.employees.find(e => e.id === a.employeeID);
    const estate = MOCK.estates.find(e => e.id === emp?.estateID);
    const group  = MOCK.groups.find(g => g.id === estate?.groupID);
    const cat    = allCats.find(c => c.id === a.techCategoryID);
    return { ...a, _emp: emp, _estate: estate, _group: group, _cat: cat };
  }), [data]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterCatID) result = result.filter(r => r.techCategoryID === Number(filterCatID));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r._emp?.name?.toLowerCase().includes(q)          ||
        r._emp?.employeeNo?.toLowerCase().includes(q)    ||
        r._estate?.name?.toLowerCase().includes(q)       ||
        r._cat?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterCatID, search]);

  /* ── Modal filter-derived lists ── */
  const filteredEstates = filterGroupID
    ? MOCK.estates.filter(e => e.groupID === Number(filterGroupID))
    : MOCK.estates;

  const registeredEmpIDs = data.map(a => a.employeeID);

  const availableEmployees = MOCK.employees.filter(e => {
    if (e.designation !== 'Technician') return false;
    if (e.status !== 'Active') return false;
    /* In Add mode: exclude already-registered; in Edit mode: include the linked employee */
    if (isAdd && registeredEmpIDs.includes(e.id)) return false;
    if (filterEstateID) return e.estateID === Number(filterEstateID);
    if (filterGroupID) {
      const est = MOCK.estates.find(est => est.id === e.estateID);
      return est?.groupID === Number(filterGroupID);
    }
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
    setForm(f => ({ ...f, employeeID: '' }));
    setErrors(e => ({ ...e, employeeID: undefined }));
  };

  const changeEstate = val => {
    setFilterEstateID(val);
    setForm(f => ({ ...f, employeeID: '' }));
    setErrors(e => ({ ...e, employeeID: undefined }));
  };

  const open = row => {
    setFilterGroupID('');
    setFilterEstateID('');
    setErrors({});
    setForm(row
      ? { employeeID: row.employeeID ?? '', techCategoryID: row.techCategoryID ?? '', notes: row.notes ?? '' }
      : EMPTY
    );
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const editingID = isAdd ? null : modal.id;
    const errs = validate(form, editingID);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const emp = MOCK.employees.find(e => e.id === Number(form.employeeID));
    const cat = allCats.find(c => c.id === Number(form.techCategoryID));
    const payload = {
      ...form,
      employeeID:     Number(form.employeeID),
      techCategoryID: Number(form.techCategoryID),
      /* Denormalised for display consistency with existing mock data */
      employeeName: emp?.name ?? '',
      categoryName: cat?.name ?? '',
    };
    if (isAdd) techAssignmentStore.add(payload);
    else       techAssignmentStore.update(modal.id, payload);
    setData(techAssignmentStore.getAll());
    close();
  };

  const del = () => {
    techAssignmentStore.remove(confirmDelete.id);
    setData(techAssignmentStore.getAll());
    setConfirmDelete(null);
  };

  /* Linked employee in edit mode */
  const editEmp    = !isAdd && modal ? MOCK.employees.find(e => e.id === modal.employeeID) : null;
  const editEstate = editEmp ? MOCK.estates.find(e => e.id === editEmp.estateID) : null;
  const editGroup  = editEstate ? MOCK.groups.find(g => g.id === editEstate.groupID) : null;

  /* Selected employee in add mode */
  const selectedEmp = isAdd ? MOCK.employees.find(e => e.id === Number(form.employeeID)) : null;
  const selectedEmpEstate = selectedEmp ? MOCK.estates.find(e => e.id === selectedEmp.estateID) : null;
  const selectedEmpGroup  = selectedEmpEstate ? MOCK.groups.find(g => g.id === selectedEmpEstate.groupID) : null;

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Technician Assignments"
        subtitle="Register employees as technicians and assign their specialisation category"
        columns={[
          {
            key: '_emp',
            label: 'Employee',
            render: v => v ? (
              <span>
                <span className="badge badge-neutral" style={{ marginRight: 6 }}>{v.employeeNo}</span>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v.name}</strong>
              </span>
            ) : '—',
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
            key: '_cat',
            label: 'Tech. Category',
            render: v => v ? (
              <span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '1px 8px', height: 22,
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 12, marginRight: 6,
                }}>
                  {v.code}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v.name}</span>
              </span>
            ) : '—',
          },
          {
            key: '_emp',
            label: 'Status',
            render: v => (
              <span className={`badge ${v?.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                {v?.status ?? '—'}
              </span>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Assign Technician"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Category filter */}
            <div className="form-group" style={{ minWidth: 200, marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-category`}
                className="form-control"
                value={filterCatID}
                onChange={e => setFilterCatID(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— All Categories —</option>
                {allCats.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            {/* Search */}
            <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by name, employee no. or estate…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(search || filterCatID) && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterCatID(''); }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} technicians
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={isAdd ? 'Assign Technician' : 'Edit Technician Assignment'}
          subtitle={
            isAdd
              ? 'Register an employee as a technician and assign their specialisation'
              : `${editEmp?.name ?? ''} — ${editEstate?.name ?? ''}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Employee ── */}
          <p className="section-label">Employee (AgriGEN ERP)</p>

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

              {/* Employee select */}
              <div className="form-group">
                <label className="form-label">Employee <span className="required">*</span></label>
                <select
                  id={`${ID}-select-employee`}
                  className={`form-control${errors.employeeID ? ' input-error' : ''}`}
                  value={form.employeeID}
                  onChange={e => set('employeeID', e.target.value)}
                >
                  <option value="">— Select Employee —</option>
                  {availableEmployees.map(e => {
                    const est = MOCK.estates.find(est => est.id === e.estateID);
                    return (
                      <option key={e.id} value={e.id}>
                        {e.employeeNo} — {e.name}{!filterEstateID ? ` (${est?.name ?? '—'})` : ''}
                      </option>
                    );
                  })}
                </select>
                {errors.employeeID
                  ? <span className="field-error">{errors.employeeID}</span>
                  : <span className="field-hint">Only active employees with designation Technician not yet assigned are shown</span>
                }
              </div>

              {/* Employee info card */}
              {selectedEmp && (
                <div style={{
                  marginTop: 10, padding: '14px 16px',
                  background: 'var(--primary-light)', border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Employee Details (from AgriGEN ERP)
                  </p>
                  <div className="form-grid form-grid-3" style={{ gap: 8 }}>
                    {[
                      ['Employee No.',  selectedEmp.employeeNo],
                      ['Full Name',     selectedEmp.name],
                      ['NIC',           selectedEmp.nic],
                      ['Designation',   selectedEmp.designation],
                      ['Group',         selectedEmpGroup?.name  ?? '—'],
                      ['Estate',        selectedEmpEstate?.name ?? '—'],
                      ['Mobile',        selectedEmp.mobile],
                      ['Join Date',     selectedEmp.joinDate],
                      ['ERP Status',    selectedEmp.status],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: '6px 10px', background: 'var(--bg-card, #fff)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Edit mode — employee read-only card */
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
                <Icon name="people" style={{ width: 18, height: 18 }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {editEmp?.name ?? `Employee #${modal?.employeeID}`}
                </p>
                <p style={{ fontSize: 12, color: 'var(--primary-dark)' }}>
                  {editEmp?.employeeNo} &nbsp;·&nbsp;
                  NIC: {editEmp?.nic} &nbsp;·&nbsp;
                  {[editGroup?.name, editEstate?.name].filter(Boolean).join(' › ')}
                </p>
              </div>
              <span style={{
                fontSize: 11, color: 'var(--primary-dark)', padding: '3px 8px',
                background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary)',
              }}>
                Linked Employee
              </span>
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Technician Category ── */}
          <p className="section-label">Technician Category</p>
          <div className="form-group">
            <label className="form-label">Category <span className="required">*</span></label>
            <select
              id={`${ID}-select-category`}
              className={`form-control${errors.techCategoryID ? ' input-error' : ''}`}
              value={form.techCategoryID}
              onChange={e => set('techCategoryID', e.target.value)}
            >
              <option value="">— Select Category —</option>
              {allCats.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
            {errors.techCategoryID && <span className="field-error">{errors.techCategoryID}</span>}
          </div>

          {/* Category preview */}
          {(() => {
            const cat = allCats.find(c => c.id === Number(form.techCategoryID));
            if (!cat) return null;
            return (
              <div style={{
                marginTop: 8, padding: '8px 14px',
                background: 'var(--bg-page)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
              }}>
                <span style={{
                  padding: '2px 10px', background: 'var(--primary-light)',
                  color: 'var(--primary-dark)', borderRadius: 'var(--radius-sm)',
                  fontWeight: 700, fontSize: 13,
                }}>
                  {cat.code}
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{cat.name}</strong>
              </div>
            );
          })()}

          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Notes</label>
            <textarea
              id={`${ID}-textarea-notes`}
              className="form-control"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional remarks about this technician assignment"
              rows={2}
            />
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
                  <div className="card-header-title">Remove Technician</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Remove technician record for{' '}
                <strong>{confirmDelete._emp?.name ?? `Employee #${confirmDelete.employeeID}`}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Category: {confirmDelete._cat?.name ?? '—'} &nbsp;·&nbsp;
                {confirmDelete._estate?.name ?? '—'}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
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
