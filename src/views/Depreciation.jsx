import { useState, useMemo } from 'react';
import { depreciationStore } from '../data/depreciationStore';
import { depreciationHistoryStore } from '../data/depreciationHistoryStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { fixedAssetTypeStore } from '../data/fixedAssetTypeStore';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'dep';

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const EMPTY = { fixedAssetID: '', assetValueDate: '', assetValue: '', usefulYears: '', residualValue: '', depreciationValue: '', groupID: '', estateID: '', status: 'Active' };

function validate(form, editingID, existingSchedules) {
  const e = {};
  if (!form.fixedAssetID) e.fixedAssetID = 'Asset is required';
  else if (!editingID && existingSchedules.some(s => s.fixedAssetID === Number(form.fixedAssetID))) {
    e.fixedAssetID = 'This asset already has a depreciation schedule';
  }
  if (!form.assetValueDate) e.assetValueDate = 'Value date is required';
  const av = parseFloat(form.assetValue);
  if (!av || av <= 0) e.assetValue = 'Asset value must be > 0';
  const uy = parseInt(form.usefulYears);
  if (!uy || uy <= 0) e.usefulYears = 'Useful years must be ≥ 1';
  return e;
}

export default function Depreciation() {
  const [data, setData]             = useState(() => depreciationStore.getAll());
  const [assets]                    = useState(() => fixedAssetStore.getAll());
  const [assetTypes]                = useState(() => fixedAssetTypeStore.getAll());
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [errors, setErrors]         = useState({});
  const [filterTypeID, setFilterTypeID] = useState('');
  const [search, setSearch]         = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* Enriched data */
  const enriched = useMemo(() => data.map(d => {
    const asset = assets.find(a => a.id === d.fixedAssetID);
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(d.assetValueDate).getTime()) / (365.25 * 86400000)));
    const totalPosted = depreciationHistoryStore.totalPostedForSchedule(d.id);
    const bookValue = Math.max(d.residualValue || 0, (d.assetValue || 0) - totalPosted);
    const pctDepreciated = d.assetValue > 0 ? Math.min(100, (totalPosted / (d.assetValue - (d.residualValue || 0))) * 100) : 0;
    return {
      ...d,
      _asset: asset,
      _type:  asset ? assetTypes.find(t => t.id === asset.fixedAssetTypeID) : null,
      _estate: MOCK.estates.find(e => e.id === d.estateID),
      _elapsed: elapsed,
      _totalPosted: totalPosted,
      _bookValue: bookValue,
      _pctDepreciated: pctDepreciated,
    };
  }), [data, assets, assetTypes]);

  /* Filtering */
  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterTypeID) rows = rows.filter(r => r._asset?.fixedAssetTypeID === Number(filterTypeID));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r._asset?.code?.toLowerCase().includes(q) ||
        r._asset?.name?.toLowerCase().includes(q) ||
        r._type?.name?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [enriched, filterTypeID, search]);

  /* Stats */
  const totalBookValue = enriched.reduce((s, r) => s + r._bookValue, 0);
  const totalAnnualDep = data.reduce((s, d) => s + (d.depreciationValue || 0), 0);
  const fullyDepCount  = enriched.filter(r => r._pctDepreciated >= 100).length;

  /* Available assets for the dropdown (exclude those with existing schedules, unless editing) */
  const availableAssets = useMemo(() => {
    const scheduledIDs = new Set(data.map(d => d.fixedAssetID));
    return assets.filter(a => !scheduledIDs.has(a.id) || (modal && modal !== 'add' && modal.fixedAssetID === a.id));
  }, [assets, data, modal]);

  /* Auto-calc depreciation */
  const calcDep = depreciationStore.calculate(form.assetValue, form.residualValue, form.usefulYears);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const open = (row) => {
    if (row) {
      setForm({
        fixedAssetID:   row.fixedAssetID ?? '',
        assetValueDate: row.assetValueDate ?? '',
        assetValue:     row.assetValue ?? '',
        usefulYears:    row.usefulYears ?? '',
        residualValue:  row.residualValue ?? '',
        depreciationValue: row.depreciationValue ?? '',
        groupID:        row.groupID ?? '',
        estateID:       row.estateID ?? '',
        status:         row.status ?? 'Active',
      });
    } else {
      setForm({ ...EMPTY });
    }
    setErrors({});
    setModal(row ?? 'add');
  };

  const close = () => { setModal(null); setErrors({}); };

  const save = () => {
    const editingID = modal !== 'add' ? modal.id : null;
    const errs = validate(form, editingID, data);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const selectedAsset = assets.find(a => a.id === Number(form.fixedAssetID));
    const payload = {
      fixedAssetID:   Number(form.fixedAssetID),
      assetValueDate: form.assetValueDate,
      assetValue:     parseFloat(form.assetValue) || 0,
      usefulYears:    parseInt(form.usefulYears) || 0,
      residualValue:  parseFloat(form.residualValue) || 0,
      depreciationValue: parseFloat(form.depreciationValue) || calcDep,
      groupID:        selectedAsset?.groupID || Number(form.groupID) || null,
      estateID:       selectedAsset?.estateID || Number(form.estateID) || null,
      status:         form.status,
    };

    if (modal === 'add') depreciationStore.add(payload);
    else                 depreciationStore.update(modal.id, payload);
    setData(depreciationStore.getAll());
    close();
  };

  const del = () => {
    depreciationStore.remove(confirmDelete.id);
    setData(depreciationStore.getAll());
    setConfirmDelete(null);
  };

  /* When asset selected, auto-fill financial fields */
  const handleAssetSelect = (assetID) => {
    set('fixedAssetID', assetID);
    if (assetID) {
      const a = assets.find(x => x.id === Number(assetID));
      if (a) {
        setForm(f => ({
          ...f,
          fixedAssetID:   assetID,
          assetValue:     a.totalCostOfAsset || '',
          residualValue:  a.residualValue || '',
          usefulYears:    a.usefulLifeYears || '',
          assetValueDate: a.startDate || '',
          groupID:        a.groupID || '',
          estateID:       a.estateID || '',
        }));
      }
    }
  };

  return (
    <>
      {/* Stats */}
      <div className="fade-up">
        <div className="summary-grid" style={{ marginBottom: 0 }}>
          <div className="summary-card">
            <div className="summary-card-icon blue"><Icon name="dollar" /></div>
            <div className="summary-card-value">{fmtCurrency(totalBookValue)}</div>
            <div className="summary-card-label">Total Book Value</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon amber"><Icon name="chart" /></div>
            <div className="summary-card-value">{fmtCurrency(totalAnnualDep)}</div>
            <div className="summary-card-label">Annual Depreciation</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon red"><Icon name="alert" /></div>
            <div className="summary-card-value">{fullyDepCount}</div>
            <div className="summary-card-label">Fully Depreciated</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon teal"><Icon name="box" /></div>
            <div className="summary-card-value">{data.length}</div>
            <div className="summary-card-label">Schedules</div>
          </div>
        </div>
      </div>

      {/* Listing */}
      <ListingPage
        idPrefix={ID}
        title="Depreciation Schedules"
        subtitle="Manage depreciation rates for each fixed asset"
        columns={[
          {
            key: '_asset',
            label: 'Asset',
            render: (v, row) => v ? (
              <div>
                <span style={{
                  display: 'inline-flex', padding: '0 8px', height: 24,
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 11,
                  alignItems: 'center', marginRight: 6,
                }}>{v.code}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{v.name}</span>
              </div>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: '_type',
            label: 'Type',
            render: v => v
              ? <span className="badge badge-primary" style={{ fontSize: 11 }}>{v.name}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'assetValue',
            label: 'Asset Value',
            render: v => <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtCurrency(v)}</span>,
          },
          {
            key: 'usefulYears',
            label: 'Life (yrs)',
            render: v => <span style={{ fontSize: 12 }}>{v} yrs</span>,
          },
          {
            key: 'residualValue',
            label: 'Residual',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtCurrency(v)}</span>,
          },
          {
            key: 'depreciationValue',
            label: 'Ann. Dep.',
            render: v => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>{fmtCurrency(v)}</span>,
          },
          {
            key: '_bookValue',
            label: 'Book Value',
            render: v => <span style={{ fontSize: 12, fontWeight: 700 }}>{fmtCurrency(v)}</span>,
          },
          {
            key: '_pctDepreciated',
            label: 'Progress',
            render: (v) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                <div style={{
                  flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(100, v)}%`, height: '100%',
                    background: v >= 100 ? 'var(--danger)' : v >= 75 ? 'var(--warning)' : 'var(--primary)',
                    borderRadius: 3, transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: v >= 100 ? 'var(--danger)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {v.toFixed(0)}%
                </span>
              </div>
            ),
          },
        ]}
        data={filtered}
        onAdd={() => open(null)}
        addLabel="Add Schedule"
        onEdit={open}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by asset code or name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              id={`${ID}-select-type`}
              className="form-control"
              style={{ minWidth: 170 }}
              value={filterTypeID}
              onChange={e => setFilterTypeID(e.target.value)}
            >
              <option value="">All Types</option>
              {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {(search || filterTypeID) && (
              <button id={`${ID}-btn-filter-clear`} className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterTypeID(''); }}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length}
            </span>
          </div>
        }
      />

      {/* Add / Edit Modal */}
      {modal && (
        <FormModal
          idPrefix={ID}
          title={modal === 'add' ? 'Add Depreciation Schedule' : 'Edit Depreciation Schedule'}
          subtitle={modal === 'add' ? 'Set depreciation parameters for a fixed asset' : `Depreciation for ${assets.find(a => a.id === modal.fixedAssetID)?.code ?? ''}`}
          onClose={close}
          onSave={save}
          isEdit={modal !== 'add'}
        >
          <p className="section-label">Asset Selection</p>
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Fixed Asset <span className="required">*</span></label>
              <select
                id={`${ID}-select-asset`}
                className={`form-control${errors.fixedAssetID ? ' input-error' : ''}`}
                value={form.fixedAssetID}
                onChange={e => handleAssetSelect(e.target.value)}
                disabled={modal !== 'add'}
              >
                <option value="">— Select Asset —</option>
                {(modal === 'add' ? availableAssets : assets).map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              {errors.fixedAssetID && <span className="field-error">{errors.fixedAssetID}</span>}
            </div>
          </div>

          <hr className="divider" style={{ margin: '16px 0' }} />

          <p className="section-label">Depreciation Parameters</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Asset Value Date <span className="required">*</span></label>
              <input id={`${ID}-input-valueDate`}
                className={`form-control${errors.assetValueDate ? ' input-error' : ''}`}
                type="date" value={form.assetValueDate}
                onChange={e => set('assetValueDate', e.target.value)} />
              {errors.assetValueDate && <span className="field-error">{errors.assetValueDate}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Asset Value (Rs.) <span className="required">*</span></label>
              <input id={`${ID}-input-assetValue`}
                className={`form-control${errors.assetValue ? ' input-error' : ''}`}
                type="number" min="0" step="0.01" value={form.assetValue}
                onChange={e => set('assetValue', e.target.value)} placeholder="0.00" />
              {errors.assetValue && <span className="field-error">{errors.assetValue}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Useful Years <span className="required">*</span></label>
              <input id={`${ID}-input-usefulYears`}
                className={`form-control${errors.usefulYears ? ' input-error' : ''}`}
                type="number" min="1" step="1" value={form.usefulYears}
                onChange={e => set('usefulYears', e.target.value)} placeholder="e.g. 10" />
              {errors.usefulYears && <span className="field-error">{errors.usefulYears}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Residual Value (Rs.)</label>
              <input id={`${ID}-input-residualValue`}
                className="form-control" type="number" min="0" step="0.01"
                value={form.residualValue}
                onChange={e => set('residualValue', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Depreciation Value (Rs. / Year)</label>
              <input id={`${ID}-input-depValue`}
                className="form-control" type="number" min="0" step="0.01"
                value={form.depreciationValue}
                onChange={e => set('depreciationValue', e.target.value)}
                placeholder={calcDep > 0 ? calcDep.toFixed(2) : '0.00'} />
              <span className="field-hint">Leave blank to auto-calculate (straight-line)</span>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select id={`${ID}-select-status`} className="form-control"
                value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Auto-calc hint */}
          {calcDep > 0 && (
            <div style={{
              marginTop: 12, padding: '8px 14px', background: 'var(--primary-light)',
              borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--primary-dark)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="chart" style={{ width: 14, height: 14, flexShrink: 0 }} />
              Straight-line: <strong>Rs. {calcDep.toLocaleString('en-LK', { maximumFractionDigits: 0 })} / year</strong>
              <span style={{ opacity: 0.7, marginLeft: 4 }}>
                ({parseInt(form.usefulYears)} years × Rs. {(calcDep / 4).toLocaleString('en-LK', { maximumFractionDigits: 0 })} / quarter)
              </span>
            </div>
          )}
        </FormModal>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#fee2e2', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Delete Depreciation Schedule</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                Delete depreciation schedule for{' '}
                <strong>{nameOf.fixedAssetName(confirmDelete.fixedAssetID)}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Annual: {fmtCurrency(confirmDelete.depreciationValue)} · {confirmDelete.usefulYears} years
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
