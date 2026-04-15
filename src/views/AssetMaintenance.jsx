import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetMaintenanceStore } from '../data/assetMaintenanceStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { Icon } from '../components/Icon';

const ID = 'am';

const STATUS_BADGE = { Active: 'badge-success', Completed: 'badge-info', Cancelled: 'badge-neutral' };

function fmtCurrency(v) {
  return `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default function AssetMaintenance() {
  const navigate = useNavigate();
  const [data, setData]             = useState(() => assetMaintenanceStore.getAll());
  const [assets]                    = useState(() => fixedAssetStore.getAll());
  const [search, setSearch]         = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const enriched = useMemo(() => data.map(m => ({
    ...m,
    _asset:    assets.find(a => a.id === m.fixedAssetID),
    _workshop: MOCK.workshops.find(w => w.id === m.workshopID),
    _estate:   MOCK.estates.find(e => e.id === m.estateID),
  })), [data, assets]);

  const filtered = useMemo(() => {
    if (!search) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(r =>
      r.maintenanceCode?.toLowerCase().includes(q) ||
      r._asset?.code?.toLowerCase().includes(q) ||
      r._asset?.name?.toLowerCase().includes(q) ||
      r._workshop?.name?.toLowerCase().includes(q)
    );
  }, [enriched, search]);

  const totalCost = data.reduce((s, m) => s + (m.totalMaintenanceCost || 0), 0);

  const del = () => {
    assetMaintenanceStore.remove(confirmDelete.id);
    setData(assetMaintenanceStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      {/* Stats */}
      <div className="fade-up">
        <div className="summary-grid" style={{ marginBottom: 0 }}>
          <div className="summary-card">
            <div className="summary-card-icon teal"><Icon name="wrench" /></div>
            <div className="summary-card-value">{data.length}</div>
            <div className="summary-card-label">Total Maintenance Records</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon amber"><Icon name="dollar" /></div>
            <div className="summary-card-value">{fmtCurrency(totalCost)}</div>
            <div className="summary-card-label">Total Maintenance Cost</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon blue"><Icon name="building" /></div>
            <div className="summary-card-value">{new Set(data.map(m => m.workshopID)).size}</div>
            <div className="summary-card-label">Workshops Used</div>
          </div>
        </div>
      </div>

      <ListingPage
        idPrefix={ID}
        title="Asset Maintenance"
        subtitle="Financial maintenance records for fixed assets"
        columns={[
          {
            key: 'maintenanceCode',
            label: 'Code',
            render: v => <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{v}</span>,
          },
          {
            key: '_asset',
            label: 'Asset',
            render: (v) => v ? (
              <div>
                <span style={{
                  display: 'inline-flex', padding: '0 6px', height: 22,
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 10,
                  alignItems: 'center', marginRight: 6,
                }}>{v.code}</span>
                <span style={{ fontSize: 12 }}>{v.name}</span>
              </div>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'maintenanceDate',
            label: 'Date',
            render: v => <span style={{ fontSize: 12 }}>{fmtDate(v)}</span>,
          },
          {
            key: '_workshop',
            label: 'Workshop',
            render: v => v
              ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.name}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'totalMaintenanceCost',
            label: 'Total Cost',
            render: v => <span style={{ fontWeight: 600, fontSize: 12 }}>{fmtCurrency(v)}</span>,
          },
          {
            key: 'details',
            label: 'Tasks',
            render: (v) => (
              <span className="badge badge-info" style={{ fontSize: 10 }}>{v?.length || 0} task{(v?.length || 0) !== 1 ? 's' : ''}</span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v || 'Active'}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => navigate('/asset-maintenance/add')}
        addLabel="Add Maintenance"
        onEdit={row => navigate(`/asset-maintenance/edit/${row.id}`)}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, asset, workshop…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button id={`${ID}-btn-filter-clear`} className="btn btn-secondary btn-sm"
                onClick={() => setSearch('')}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {filtered.length} of {data.length}
            </span>
          </div>
        }
      />

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#fee2e2', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Delete Maintenance Record</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                Delete <strong>{confirmDelete.maintenanceCode}</strong> for asset{' '}
                <strong>{nameOf.fixedAssetName(confirmDelete.fixedAssetID)}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Cost: {fmtCurrency(confirmDelete.totalMaintenanceCost)} · {fmtDate(confirmDelete.maintenanceDate)}
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
