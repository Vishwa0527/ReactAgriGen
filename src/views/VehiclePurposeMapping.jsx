import { useState, useMemo } from 'react';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'vpm';

const EMPTY = {
  vehicleID:          '',
  selectedPurposeIDs: [],  // checked purposes (add = new; edit = pre-loaded current set)
  effectiveDate:      '',
  notes:              '',
};

const MODULE_BADGE = {
  Field:      'badge-success',
  Inventory:  'badge-warning',
  HR:         'badge-info',
  Production: 'badge-primary',
  Finance:    'badge-danger',
  Fleet:      'badge-neutral',
  Other:      'badge-neutral',
};

function validate(form, isAdd) {
  const e = {};
  if (!form.vehicleID) e.vehicleID = 'Vehicle is required';
  if (isAdd && form.selectedPurposeIDs.length === 0)
    e.selectedPurposeIDs = 'Select at least one purpose category';
  return e;
}

const vehicleLabel = (id) => {
  const v = MOCK.vehicles.find(v => v.id === Number(id));
  return v ? `${v.numbers} — ${v.brand} ${v.model}` : `Vehicle #${id}`;
};

export default function VehiclePurposeMapping() {
  const [data, setData]                   = useState(MOCK.vehiclePurposeMappings);
  const [modal, setModal]                 = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [errors, setErrors]               = useState({});
  const [search, setSearch]               = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isAdd = modal === 'add';

  /* Add mode: purposes already mapped for chosen vehicle → show disabled */
  const alreadyMappedIDs = useMemo(() =>
    (isAdd && form.vehicleID)
      ? data.filter(r => r.vehicleID === Number(form.vehicleID)).map(r => r.purposeCategoryID)
      : [],
  [data, form.vehicleID, isAdd]);

  /* Enrich rows with computed _module for a distinct column key */
  const enriched = useMemo(() => data.map(r => ({
    ...r,
    _module: MOCK.purposeCategories.find(p => p.id === r.purposeCategoryID)?.module ?? '',
  })), [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return enriched;
    return enriched.filter(r =>
      vehicleLabel(r.vehicleID).toLowerCase().includes(q) ||
      nameOf.purposeCat(r.purposeCategoryID).toLowerCase().includes(q) ||
      r._module.toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  }, [enriched, search]);

  const set = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === 'vehicleID') next.selectedPurposeIDs = []; // clear when vehicle changes
      return next;
    });
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const togglePurpose = (pid) => {
    setForm(f => ({
      ...f,
      selectedPurposeIDs: f.selectedPurposeIDs.includes(pid)
        ? f.selectedPurposeIDs.filter(id => id !== pid)
        : [...f.selectedPurposeIDs, pid],
    }));
    if (errors.selectedPurposeIDs) setErrors(e => ({ ...e, selectedPurposeIDs: undefined }));
  };

  const open = (row) => {
    if (row) {
      /* Edit — pre-check ALL currently mapped purposes for this vehicle */
      const currentlyMapped = data
        .filter(r => r.vehicleID === row.vehicleID)
        .map(r => r.purposeCategoryID);
      setForm({
        vehicleID:          row.vehicleID,
        selectedPurposeIDs: currentlyMapped,
        effectiveDate:      row.effectiveDate ?? '',
        notes:              row.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
    setModal(row ?? 'add');
  };
  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const errs = validate(form, isAdd);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const vid = Number(form.vehicleID);

    if (isAdd) {
      /* Create one record per selected purpose */
      const newRecords = form.selectedPurposeIDs.map((pid, i) => ({
        id: Date.now() + i,
        vehicleID:         vid,
        purposeCategoryID: Number(pid),
        effectiveDate:     form.effectiveDate,
        notes:             form.notes,
      }));
      setData(d => [...d, ...newRecords]);
    } else {
      /* Edit — sync: remove unchecked, add newly checked, leave existing checked unchanged */
      const currentMappings = data.filter(r => r.vehicleID === vid);
      const currentIDs      = currentMappings.map(r => r.purposeCategoryID);
      const toRemove        = currentIDs.filter(id => !form.selectedPurposeIDs.includes(id));
      const toAdd           = form.selectedPurposeIDs.filter(id => !currentIDs.includes(id));

      setData(d => {
        const pruned   = d.filter(r => !(r.vehicleID === vid && toRemove.includes(r.purposeCategoryID)));
        const added    = toAdd.map((pid, i) => ({
          id: Date.now() + i,
          vehicleID:         vid,
          purposeCategoryID: Number(pid),
          effectiveDate:     form.effectiveDate,
          notes:             form.notes,
        }));
        return [...pruned, ...added];
      });
    }
    close();
  };

  const del = () => {
    setData(d => d.filter(r => r.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  /* ── Checkbox card list (shared by both Add and Edit) ── */
  const PurposeCheckboxList = () => {
    const selectedCount = form.selectedPurposeIDs.length;
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p className="section-label" style={{ margin: 0 }}>
            {isAdd ? <>Select Purposes <span className="required">*</span></> : 'Manage Purposes'}
          </p>
          {selectedCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-dark)' }}>
              {selectedCount} purpose{selectedCount !== 1 ? 's' : ''} {isAdd ? 'selected' : 'assigned'}
            </span>
          )}
        </div>

        {!isAdd && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
            Checked purposes are currently assigned. Uncheck to remove; check new ones to add.
            Effective date and notes below apply only to newly added purposes.
          </p>
        )}

        {isAdd && !form.vehicleID && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
            Select a vehicle above to see available purposes.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
          {MOCK.purposeCategories.map(p => {
            const isChecked   = form.selectedPurposeIDs.includes(p.id);
            /* In Add mode, disable purposes already mapped to this vehicle */
            const isDisabled  = isAdd && alreadyMappedIDs.includes(p.id);

            return (
              <div
                key={p.id}
                id={`${ID}-purpose-card-${p.id}`}
                onClick={() => !isDisabled && togglePurpose(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: isChecked ? 'var(--primary-light)' : 'var(--bg-page)',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.55 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <input
                  id={`${ID}-checkbox-purpose-${p.id}`}
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => !isDisabled && togglePurpose(p.id)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: 15, height: 15,
                    accentColor: 'var(--primary)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{p.code}</span>
                </div>
                {isDisabled
                  ? <span className="badge badge-neutral">Already assigned</span>
                  : <span className={`badge ${MODULE_BADGE[p.module] ?? 'badge-neutral'}`}>{p.module}</span>
                }
              </div>
            );
          })}
        </div>

        {errors.selectedPurposeIDs && (
          <span className="field-error" style={{ marginTop: 4 }}>{errors.selectedPurposeIDs}</span>
        )}
      </>
    );
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Vehicle Purpose Mapping"
        subtitle="Assign operational purposes to vehicles — one vehicle can serve multiple ERP module purposes"
        columns={[
          {
            key: 'vehicleID',
            label: 'Vehicle',
            render: v => (
              <span>
                <span className="badge badge-primary" style={{ marginRight: 6 }}>
                  {MOCK.vehicles.find(x => x.id === v)?.numbers ?? `#${v}`}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {(() => { const veh = MOCK.vehicles.find(x => x.id === v); return veh ? `${veh.brand} ${veh.model}` : ''; })()}
                </span>
              </span>
            ),
          },
          { key: 'purposeCategoryID', label: 'Purpose', render: v => nameOf.purposeCat(v) },
          {
            key: '_module',
            label: 'ERP Module',
            render: v => v
              ? <span className={`badge ${MODULE_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          { key: 'effectiveDate', label: 'Effective Date', render: v => v || <span style={{ color: 'var(--text-muted)' }}>—</span> },
          { key: 'notes', label: 'Notes', render: v => v ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Purpose Mapping"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by vehicle, purpose, module or notes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button id={`${ID}-btn-search-clear`} className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
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
          title={isAdd ? 'Add Purpose Mapping' : 'Manage Vehicle Purposes'}
          subtitle={isAdd
            ? 'Select a vehicle, then check all purposes to assign in one step'
            : `Managing: ${vehicleLabel(modal.vehicleID)}`}
          onClose={close}
          onSave={save}
          isEdit={!isAdd}
        >
          {/* ── Vehicle ── */}
          <p className="section-label">Vehicle</p>

          {isAdd ? (
            /* Add mode: vehicle dropdown */
            <div className="form-group">
              <label className="form-label">Vehicle <span className="required">*</span></label>
              <select
                id={`${ID}-select-vehicle`}
                className={`form-control${errors.vehicleID ? ' input-error' : ''}`}
                value={form.vehicleID}
                onChange={e => set('vehicleID', e.target.value)}
              >
                <option value="">— Select Vehicle —</option>
                {MOCK.vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.numbers} — {v.brand} {v.model}</option>
                ))}
              </select>
              {errors.vehicleID && <span className="field-error">{errors.vehicleID}</span>}
            </div>
          ) : (
            /* Edit mode: vehicle shown read-only */
            <div
              id={`${ID}-vehicle-display`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span className="badge badge-primary">
                {MOCK.vehicles.find(v => v.id === Number(form.vehicleID))?.numbers}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary-dark)' }}>
                {(() => { const v = MOCK.vehicles.find(v => v.id === Number(form.vehicleID)); return v ? `${v.brand} ${v.model}` : ''; })()}
              </span>
              <Icon name="id" style={{ width: 14, height: 14, color: 'var(--primary)', marginLeft: 'auto' }} />
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Purpose checkbox list (shared by both modes) ── */}
          <PurposeCheckboxList />

          <hr className="divider" style={{ margin: '16px 0' }} />

          {/* ── Assignment Details ── */}
          <p className="section-label">Assignment Details</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Effective Date</label>
              <input
                id={`${ID}-input-effective-date`}
                type="date"
                className="form-control"
                value={form.effectiveDate}
                onChange={e => set('effectiveDate', e.target.value)}
              />
              <span className="field-hint">
                {isAdd ? 'Applied to all selected purposes' : 'Applied to newly added purposes only'}
              </span>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notes</label>
              <textarea
                id={`${ID}-textarea-notes`}
                className="form-control"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder={isAdd ? 'Optional notes applied to all selected purposes' : 'Optional notes for newly added purposes'}
                rows={2}
              />
            </div>
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
                  <div className="card-header-title">Remove Purpose Mapping</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Remove purpose <strong>{nameOf.purposeCat(confirmDelete.purposeCategoryID)}</strong> from{' '}
                <strong>{vehicleLabel(confirmDelete.vehicleID)}</strong>?
              </p>
              {confirmDelete.notes && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  Notes: {confirmDelete.notes}
                </p>
              )}
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
