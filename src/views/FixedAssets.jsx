import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { fixedAssetTypeStore } from '../data/fixedAssetTypeStore';
import { fixedAssetCategoryStore } from '../data/fixedAssetCategoryStore';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { Icon } from '../components/Icon';

const ID = 'far';

const STATUS_BADGE = { Active: 'badge-success', Inactive: 'badge-neutral', Disposed: 'badge-danger' };

function fmtCurrency(v) {
  return `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export default function FixedAssets() {
  const navigate = useNavigate();
  const [data, setData]                   = useState(() => fixedAssetStore.getAll());
  const [assetTypes]                      = useState(() => fixedAssetTypeStore.getAll());
  const [assetCategories]                 = useState(() => fixedAssetCategoryStore.getAll());
  const [search, setSearch]               = useState('');
  const [filterTypeID, setFilterTypeID]   = useState('');
  const [filterCatID, setFilterCatID]     = useState('');
  const [filterStatus, setFilterStatus]   = useState('Active');
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* Enrichment */
  const enriched = useMemo(() => data.map(a => ({
    ...a,
    _type:     assetTypes.find(t => t.id === a.fixedAssetTypeID),
    _category: assetCategories.find(c => c.id === a.fixedAssetCategoryID),
    _estate:   MOCK.estates.find(e => e.id === a.estateID),
    _group:    MOCK.groups.find(g => g.id === a.groupID),
  })), [data, assetTypes, assetCategories]);

  /* Filtering */
  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterTypeID)  rows = rows.filter(r => r.fixedAssetTypeID === Number(filterTypeID));
    if (filterCatID)   rows = rows.filter(r => r.fixedAssetCategoryID === Number(filterCatID));
    if (filterStatus !== 'All') rows = rows.filter(r => r.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.code?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q) ||
        r.registrationNumber?.toLowerCase().includes(q) ||
        r._type?.name?.toLowerCase().includes(q) ||
        r._category?.name?.toLowerCase().includes(q) ||
        r._estate?.name?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [enriched, filterTypeID, filterCatID, filterStatus, search]);

  /* Cascading categories based on type filter */
  const filteredCategories = useMemo(() =>
    filterTypeID
      ? assetCategories.filter(c => c.fixedAssetTypeID === Number(filterTypeID))
      : assetCategories,
    [assetCategories, filterTypeID]
  );

  /* Stats */
  const totalAssets = data.length;
  const totalValue  = data.reduce((s, a) => s + (a.totalCostOfAsset || 0), 0);
  const totalDep    = data.reduce((s, a) => s + (a.depreciationValue || 0), 0);
  const warrantyActive = data.filter(a => a.isWarrantyEnabled && a.warrantyEndDate && a.warrantyEndDate >= new Date().toISOString().slice(0, 10)).length;

  const del = () => {
    fixedAssetStore.remove(confirmDelete.id);
    setData(fixedAssetStore.getAll());
    setConfirmDelete(null);
  };

  const clearFilters = () => { setSearch(''); setFilterTypeID(''); setFilterCatID(''); setFilterStatus('Active'); };
  const isFiltered = search || filterTypeID || filterCatID || filterStatus !== 'Active';

  return (
    <>
      {/* Stats Row */}
      <div className="fade-up">
        <div className="summary-grid" style={{ marginBottom: 0 }}>
          <div className="summary-card">
            <div className="summary-card-icon teal"><Icon name="box" /></div>
            <div className="summary-card-value">{totalAssets}</div>
            <div className="summary-card-label">Total Assets</div>
            <div className="summary-card-trend">{fixedAssetStore.activeCount()} active</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon blue"><Icon name="dollar" /></div>
            <div className="summary-card-value">{fmtCurrency(totalValue)}</div>
            <div className="summary-card-label">Total Asset Value</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon amber"><Icon name="chart" /></div>
            <div className="summary-card-value">{fmtCurrency(totalDep)}</div>
            <div className="summary-card-label">Annual Depreciation</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon purple"><Icon name="check" /></div>
            <div className="summary-card-value">{warrantyActive}</div>
            <div className="summary-card-label">Under Warranty</div>
          </div>
        </div>
      </div>

      {/* Listing */}
      <ListingPage
        idPrefix={ID}
        title="Assets Register"
        subtitle="Fixed asset inventory — vehicles, machinery, equipment & infrastructure"
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: v => (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 72, padding: '0 10px', height: 32,
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13,
              }}>
                {v}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Asset Name',
            render: (v, row) => (
              <div>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</strong>
                {row.registrationNumber && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {row.registrationNumber}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: '_type',
            label: 'Type',
            render: v => v
              ? <span className="badge badge-primary" style={{ fontSize: 11 }}>{v.name}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: '_category',
            label: 'Category',
            render: v => v
              ? <span className="badge badge-neutral" style={{ fontSize: 11 }}>{v.name}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: '_estate',
            label: 'Estate',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v?.name ?? '—'}</span>,
          },
          {
            key: 'totalCostOfAsset',
            label: 'Cost',
            render: v => <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtCurrency(v)}</span>,
          },
          {
            key: 'depreciationValue',
            label: 'Ann. Dep.',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtCurrency(v)}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => navigate('/assets-register/add')}
        addLabel="Add Asset"
        onEdit={row => navigate(`/assets-register/edit/${row.id}`)}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, name, registration…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              id={`${ID}-select-type`}
              className="form-control"
              style={{ minWidth: 170 }}
              value={filterTypeID}
              onChange={e => { setFilterTypeID(e.target.value); setFilterCatID(''); }}
            >
              <option value="">All Types</option>
              {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select
              id={`${ID}-select-category`}
              className="form-control"
              style={{ minWidth: 170 }}
              value={filterCatID}
              onChange={e => setFilterCatID(e.target.value)}
            >
              <option value="">All Categories</option>
              {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
              {['All', 'Active', 'Inactive', 'Disposed'].map((s, i, arr) => (
                <button
                  key={s}
                  id={`${ID}-btn-status-${s.toLowerCase()}`}
                  style={{
                    border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    borderRadius: 0, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                    background: filterStatus === s ? 'var(--primary)' : 'transparent',
                    color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                    fontWeight: filterStatus === s ? 600 : 400,
                  }}
                  onClick={() => setFilterStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {isFiltered && (
              <button id={`${ID}-btn-filter-clear`} className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length} assets
            </span>
          </div>
        }
      />

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 480 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#fee2e2', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Delete Fixed Asset</div>
                  <div className="card-header-sub">This will soft-delete the asset and cascade to related records</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete asset{' '}
                <span style={{
                  display: 'inline-flex', padding: '1px 8px',
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 12, verticalAlign: 'middle', margin: '0 4px',
                }}>
                  {confirmDelete.code}
                </span>
                <strong>{confirmDelete.name}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Cost: {fmtCurrency(confirmDelete.totalCostOfAsset)} · {nameOf.fixedAssetType(confirmDelete.fixedAssetTypeID)}
              </p>
              <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8, background: '#fef2f2', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                <Icon name="alert" style={{ width: 12, height: 12, verticalAlign: 'middle', marginRight: 4 }} />
                This will also affect: Asset History, Depreciation, Maintenance & Estimation records.
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
