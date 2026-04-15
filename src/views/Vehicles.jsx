import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK, nameOf } from '../data/mockData';
import { vehicleStore } from '../data/vehicleStore';
import { ListingPage } from '../components/ListingPage';
import { Icon } from '../components/Icon';

const ID = 'vehicles';

/* ── Status badge ── */
const STATUS_CLASS = {
  'Active':      'badge-success',
  'In Service':  'badge-info',
  'Maintenance': 'badge-warning',
  'Inactive':    'badge-danger',
};

export default function Vehicles() {
  const navigate = useNavigate();
  const [data, setData] = useState(() => vehicleStore.getAll());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');

  /* ── Lookup helpers ── */
  const vtName     = id => MOCK.vehicleTypes.find(v => v.id === id)?.name ?? '—';
  const estateName = id => MOCK.estates.find(e => e.id === id)?.name ?? '—';
  const fuelName   = id => MOCK.fuelTypes.find(f => f.id === id)?.name ?? '—';

  /* ── Filtered data ── */
  const filtered = (() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(r =>
      r.numbers.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q) ||
      vtName(r.vehicleTypeID).toLowerCase().includes(q) ||
      estateName(r.estateID).toLowerCase().includes(q)
    );
  })();

  /* ── Delete ── */
  const handleDelete = () => {
    vehicleStore.remove(confirmDelete.id);
    setData(vehicleStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Vehicles"
        subtitle="Fleet vehicle register — all registered vehicles across estates"
        columns={[
          {
            key: 'numbers',
            label: 'Registration No.',
            render: v => <span className="badge badge-primary">{v}</span>,
          },
          {
            key: 'brand',
            label: 'Brand / Model',
            render: (v, row) => (
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{v}</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{row.model}</span>
              </span>
            ),
          },
          {
            key: 'vehicleTypeID',
            label: 'Vehicle Type',
            render: v => vtName(v),
          },
          {
            key: 'estateID',
            label: 'Estate',
            render: v => estateName(v),
          },
          {
            key: 'fuelTypeID',
            label: 'Primary Fuel',
            render: v => fuelName(v),
          },
          {
            key: 'fixedAssetID',
            label: 'Fixed Asset',
            render: v => v
              ? <span className="badge badge-info" style={{ fontSize: 10 }}>
                  {nameOf.fixedAssetCode(v)}
                </span>
              : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>,
          },
          {
            key: 'costOfAsset',
            label: 'Cost (Rs.)',
            render: v => v ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Number(v).toLocaleString('en-LK')}
            </span> : '—',
          },
          {
            key: 'status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_CLASS[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => navigate('/vehicles/add')}
        addLabel="Add Vehicle"
        onEdit={row => navigate(`/vehicles/edit/${row.id}`)}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by reg. no., brand, model, type or estate…"
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
              {filtered.length} of {data.length} vehicles
            </span>
          </div>
        }
      />

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
                  <div className="card-header-title">Delete Vehicle</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete{' '}
                <strong>{confirmDelete.brand} {confirmDelete.model}</strong>{' '}
                <span className="badge badge-neutral" style={{ verticalAlign: 'middle' }}>
                  {confirmDelete.numbers}
                </span>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Estate: {estateName(confirmDelete.estateID)} &nbsp;·&nbsp;
                Type: {vtName(confirmDelete.vehicleTypeID)}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={handleDelete}>
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
