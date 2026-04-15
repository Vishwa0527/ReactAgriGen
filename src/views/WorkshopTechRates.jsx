import { useState, useMemo } from 'react';
import { MOCK } from '../data/mockData';
import { workshopStore }         from '../data/workshopStore';
import { workshopCategoryStore } from '../data/workshopCategoryStore';
import { techCategoryStore }     from '../data/techCategoryStore';
import { workshopTechRateStore } from '../data/workshopTechRateStore';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'wtr';

const RATE_TYPES = ['Per Day', 'Per Hour', 'Per Task', 'Per Vehicle'];

const EMPTY = { code: '', workshopID: '', techCategoryID: '', rateType: 'Per Task', rateAmount: '' };

/* ── Validation ── */
function validate(form, editingID) {
  const e = {};
  if (!form.code.trim()) {
    e.code = 'Code is required';
  } else if (!workshopTechRateStore.isCodeUnique(form.code.trim().toUpperCase(), editingID)) {
    e.code = 'This code is already in use';
  }
  if (!form.workshopID)     e.workshopID     = 'Workshop is required';
  if (!form.techCategoryID) e.techCategoryID = 'Technician category is required';
  if (!form.rateType)   e.rateType = 'Rate type is required';
  if (!form.rateAmount || Number(form.rateAmount) <= 0) {
    e.rateAmount = 'Enter a valid amount greater than 0';
  }
  if (form.workshopID && form.techCategoryID) {
    if (workshopTechRateStore.isDuplicate(Number(form.workshopID), Number(form.techCategoryID), editingID)) {
      e.techCategoryID = 'A rate for this workshop + category already exists';
    }
  }
  return e;
}

export default function WorkshopTechRates() {
  const [data, setData]               = useState(() => workshopTechRateStore.getAll());
  const [modal, setModal]             = useState(null);   // null | 'add' | row
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [filterCategoryID, setFilterCategoryID] = useState('');
  const [filterWsID, setFilterWsID]   = useState('');
  const [search, setSearch]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* UI-only modal filters */
  const [modalCategoryID, setModalCategoryID] = useState('');
  const [filterGroupID,   setFilterGroupID]   = useState('');
  const [filterEstateID,  setFilterEstateID]  = useState('');

  const isAdd          = modal === 'add';
  const allWs          = workshopStore.getAll();
  const allCats        = techCategoryStore.getAll();
  const allWsCategories = workshopCategoryStore.getAll();

  /* ── Enriched listing data ── */
  const enriched = useMemo(() => data.map(r => {
    const ws     = allWs.find(w => w.id === r.workshopID);
    const cat    = allCats.find(c => c.id === r.techCategoryID);
    const estate = MOCK.estates.find(e => e.id === ws?.estateID);
    return { ...r, _ws: ws, _cat: cat, _estate: estate };
  }), [data]);

  /* Workshops visible in the listing filter (scoped to selected category) */
  const listingWs = filterCategoryID
    ? allWs.filter(w => w.workshopCategoryID === Number(filterCategoryID))
    : allWs;

  const filtered = useMemo(() => {
    let result = enriched;
    if (filterCategoryID) {
      result = result.filter(r => r._ws?.workshopCategoryID === Number(filterCategoryID));
    }
    if (filterWsID) result = result.filter(r => r.workshopID === Number(filterWsID));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.code?.toLowerCase().includes(q)          ||
        r._ws?.name?.toLowerCase().includes(q)     ||
        r._cat?.name?.toLowerCase().includes(q)    ||
        r._estate?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, filterCategoryID, filterWsID, search]);

  /* ── Modal filter-derived lists ── */
  const filteredEstates = filterGroupID
    ? MOCK.estates.filter(e => e.groupID === Number(filterGroupID))
    : MOCK.estates;

  const availableWorkshops = allWs.filter(w => {
    if (modalCategoryID && w.workshopCategoryID !== Number(modalCategoryID)) return false;
    if (filterEstateID) return w.estateID === Number(filterEstateID);
    if (filterGroupID)  return w.groupID  === Number(filterGroupID);
    return true;
  });

  /* ── Helpers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const changeModalCategory = val => {
    setModalCategoryID(val);
    setFilterGroupID('');
    setFilterEstateID('');
    setForm(f => ({ ...f, workshopID: '' }));
    setErrors(e => ({ ...e, workshopID: undefined }));
  };

  const changeGroup = val => {
    setFilterGroupID(val);
    setFilterEstateID('');
    setForm(f => ({ ...f, workshopID: '' }));
    setErrors(e => ({ ...e, workshopID: undefined }));
  };

  const changeEstate = val => {
    setFilterEstateID(val);
    setForm(f => ({ ...f, workshopID: '' }));
    setErrors(e => ({ ...e, workshopID: undefined }));
  };

  const open = row => {
    setModalCategoryID('');
    setFilterGroupID('');
    setFilterEstateID('');
    setErrors({});
    setForm(row
      ? {
          code:           row.code           ?? '',
          workshopID:     row.workshopID     ?? '',
          techCategoryID: row.techCategoryID ?? '',
          rateType:       row.rateType       ?? 'Per Task',
          rateAmount:     row.rateAmount     ?? '',
        }
      : { ...EMPTY, code: workshopTechRateStore.nextCode() }
    );
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const editingID = isAdd ? null : modal.id;
    const errs = validate(form, editingID);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const ws  = allWs.find(w => w.id === Number(form.workshopID));
    const cat = allCats.find(c => c.id === Number(form.techCategoryID));
    const payload = {
      ...form,
      code:           form.code.trim().toUpperCase(),
      workshopID:     Number(form.workshopID),
      techCategoryID: Number(form.techCategoryID),
      rateType:       form.rateType,
      rateAmount:     Number(form.rateAmount),
      workshopName:   ws?.name  ?? '',
      categoryName:   cat?.name ?? '',
    };
    if (isAdd) workshopTechRateStore.add(payload);
    else       workshopTechRateStore.update(modal.id, payload);
    setData(workshopTechRateStore.getAll());
    close();
  };

  const del = () => {
    workshopTechRateStore.remove(confirmDelete.id);
    setData(workshopTechRateStore.getAll());
    setConfirmDelete(null);
  };

  /* Edit mode: workshop info */
  const editWs    = !isAdd && modal ? allWs.find(w => w.id === modal.workshopID)        : null;
  const editEstate = editWs ? MOCK.estates.find(e => e.id === editWs.estateID)           : null;
  const editGroup  = editEstate ? MOCK.groups.find(g => g.id === editEstate.groupID)     : null;

  /* Selected workshop in add mode */
  const selectedWs    = isAdd ? allWs.find(w => w.id === Number(form.workshopID))          : null;
  const selectedEstate = selectedWs ? MOCK.estates.find(e => e.id === selectedWs.estateID) : null;

  /* Current category (add or edit) */
  const currentCat = allCats.find(c => c.id === Number(form.techCategoryID));

  /* Current workshop (add or edit) */
  const currentWs = isAdd ? selectedWs : editWs;

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Workshop Tech. Rates"
        subtitle="Define per-task technician rates for each workshop and category"
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: v => <span className="badge badge-neutral">{v}</span>,
          },
          {
            key: '_ws',
            label: 'Workshop',
            render: v => v ? (
              <span>
                <span className="badge badge-neutral" style={{ marginRight: 6 }}>{v.code}</span>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v.name}</strong>
              </span>
            ) : '—',
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
            key: 'rateType',
            label: 'Rate Type',
            render: v => (
              <span className="badge badge-neutral">{v ?? '—'}</span>
            ),
          },
          {
            key: 'rateAmount',
            label: 'Amount (Rs.)',
            render: v => (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {v ? Number(v).toLocaleString() : '—'}
              </span>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Rate"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Workshop Category filter */}
            <div className="form-group" style={{ minWidth: 185, marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-category`}
                className="form-control"
                value={filterCategoryID}
                onChange={e => {
                  setFilterCategoryID(e.target.value);
                  // reset workshop filter if it doesn't belong to the new category
                  if (e.target.value && filterWsID) {
                    const ws = allWs.find(w => w.id === Number(filterWsID));
                    if (ws && ws.workshopCategoryID !== Number(e.target.value)) setFilterWsID('');
                  }
                }}
              >
                <option value="">— All Categories —</option>
                {allWsCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Workshop filter */}
            <div className="form-group" style={{ minWidth: 200, marginBottom: 0 }}>
              <select
                id={`${ID}-select-filter-workshop`}
                className="form-control"
                value={filterWsID}
                onChange={e => setFilterWsID(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— All Workshops —</option>
                {listingWs.map(w => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </div>
            {/* Search */}
            <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, workshop or category…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(search || filterCategoryID || filterWsID) && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterCategoryID(''); setFilterWsID(''); }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} rates
            </span>
          </div>
        }
      />

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={isAdd ? 'Add Tech. Rate' : 'Edit Tech. Rate'}
          subtitle={
            isAdd
              ? 'Define a per-task rate for a workshop and technician category'
              : `Editing: ${modal.code}`
          }
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Workshop ── */}
          <p className="section-label">Workshop</p>

          {isAdd ? (
            <>
              {/* Workshop Category filter */}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Workshop Category</label>
                <select
                  id={`${ID}-select-modal-category`}
                  className="form-control"
                  value={modalCategoryID}
                  onChange={e => changeModalCategory(e.target.value)}
                >
                  <option value="">— All Categories —</option>
                  {allWsCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

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
                  {availableWorkshops.map(w => {
                    const est = MOCK.estates.find(e => e.id === w.estateID);
                    return (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}{!filterEstateID ? ` (${est?.name ?? '—'})` : ''}
                      </option>
                    );
                  })}
                </select>
                {errors.workshopID && <span className="field-error">{errors.workshopID}</span>}
              </div>

              {/* Workshop preview row */}
              {selectedWs && (
                <div style={{
                  marginTop: 8, padding: '8px 14px',
                  background: 'var(--bg-page)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)', color: 'var(--primary-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="building" style={{ width: 15, height: 15 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedWs.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {selectedWs.code} · {selectedEstate?.name ?? '—'}
                    </p>
                  </div>
                  <span
                    className={`badge ${selectedWs.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}
                    style={{ marginLeft: 'auto' }}
                  >
                    {selectedWs.status}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Edit mode — workshop read-only card */
            <div
              id={`${ID}-workshop-display`}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px',
                background: 'var(--primary-light)', border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="building" style={{ width: 18, height: 18 }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {editWs?.name ?? `Workshop #${modal?.workshopID}`}
                </p>
                <p style={{ fontSize: 12, color: 'var(--primary-dark)' }}>
                  {editWs?.code} &nbsp;·&nbsp;
                  {[editGroup?.name, editEstate?.name].filter(Boolean).join(' › ')}
                </p>
              </div>
              <span style={{
                fontSize: 11, color: 'var(--primary-dark)', padding: '3px 8px',
                background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary)',
              }}>
                Linked Workshop
              </span>
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Rate Details ── */}
          <p className="section-label">Rate Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Code <span className="required">*</span></label>
              <input
                id={`${ID}-input-code`}
                className={`form-control${errors.code ? ' input-error' : ''}`}
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="e.g. WTR004"
              />
              {errors.code
                ? <span className="field-error">{errors.code}</span>
                : <span className="field-hint">Auto-generated — you may edit if needed</span>
              }
            </div>

            <div className="form-group">
              <label className="form-label">Tech. Category <span className="required">*</span></label>
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

            <div className="form-group">
              <label className="form-label">Rate Type <span className="required">*</span></label>
              <select
                id={`${ID}-select-rate-type`}
                className={`form-control${errors.rateType ? ' input-error' : ''}`}
                value={form.rateType}
                onChange={e => set('rateType', e.target.value)}
              >
                {RATE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {errors.rateType && <span className="field-error">{errors.rateType}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">
                Amount (Rs.) <span className="required">*</span>
              </label>
              <input
                id={`${ID}-input-amount`}
                type="number"
                min="1"
                step="0.01"
                className={`form-control${errors.rateAmount ? ' input-error' : ''}`}
                value={form.rateAmount}
                onChange={e => set('rateAmount', e.target.value)}
                placeholder="e.g. 2500"
              />
              {errors.rateAmount
                ? <span className="field-error">{errors.rateAmount}</span>
                : <span className="field-hint">{form.rateType} rate in Rupees</span>
              }
            </div>
          </div>

          {/* Preview */}
          {(form.workshopID || !isAdd) && form.techCategoryID && form.rateAmount && (
            <div style={{
              marginTop: 14, padding: '10px 16px',
              background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontWeight: 800, fontSize: 11, letterSpacing: '0.03em',
              }}>
                Rs.
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentCat?.name ?? '—'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {currentWs?.name ?? '—'}{form.code ? ` · ${form.code}` : ''}
                </p>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-dark)' }}>
                  Rs. {Number(form.rateAmount).toLocaleString()}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{form.rateType}</p>
              </div>
            </div>
          )}
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
                  <div className="card-header-title">Delete Rate</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete rate <strong>{confirmDelete.code}</strong> for{' '}
                <strong>{confirmDelete._cat?.name ?? confirmDelete.categoryName}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {confirmDelete._ws?.name ?? confirmDelete.workshopName}
                &nbsp;·&nbsp;
                Rs. {Number(confirmDelete.rateAmount).toLocaleString()} {confirmDelete.rateType}
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
