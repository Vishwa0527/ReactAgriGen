import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK } from '../data/mockData';
import { driverStore } from '../data/driverStore';
import { ListingPage } from '../components/ListingPage';
import { Icon } from '../components/Icon';

const ID = 'drivers';

function calcLicStatus(expireDate) {
  if (!expireDate) return 'Unknown';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expireDate);
  const daysLeft = Math.ceil((expiry - today) / 86400000);
  if (daysLeft < 0)   return 'Expired';
  if (daysLeft <= 30) return 'Expiring Soon';
  return 'Valid';
}

const LIC_STATUS_BADGE = {
  'Valid':         'badge-success',
  'Expiring Soon': 'badge-warning',
  'Expired':       'badge-danger',
  'Unknown':       'badge-neutral',
};

const DRIVER_STATUS_BADGE = {
  'Active':    'badge-success',
  'On Leave':  'badge-info',
  'Suspended': 'badge-warning',
  'Inactive':  'badge-danger',
};

export default function Drivers() {
  const navigate = useNavigate();
  const [data, setData]           = useState(() => driverStore.getAll());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch]       = useState('');

  const estateName    = id => MOCK.estates.find(e => e.id === id)?.name ?? '—';
  const employeeOf    = empID => MOCK.employees.find(e => e.id === empID);
  const licCatOf      = id => MOCK.licenseCategories.find(l => l.id === id);

  const enriched = data.map(d => {
    const emp = employeeOf(d.employeeID);
    const cat = licCatOf(d.licenseCategoryID);
    return {
      ...d,
      _estate:    estateName(emp?.estateID),
      _licCat:    cat,
      _licStatus: calcLicStatus(d.licExpireDate),
    };
  });

  const filtered = (() => {
    const q = search.toLowerCase();
    if (!q) return enriched;
    return enriched.filter(r =>
      r.code?.toLowerCase().includes(q)         ||
      r.name?.toLowerCase().includes(q)         ||
      r.licenseNo?.toLowerCase().includes(q)    ||
      r._estate?.toLowerCase().includes(q)      ||
      r._licStatus?.toLowerCase().includes(q)   ||
      r.status?.toLowerCase().includes(q)
    );
  })();

  const handleDelete = () => {
    driverStore.remove(confirmDelete.id);
    setData(driverStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Drivers"
        subtitle="Fleet drivers linked from AgriGEN ERP — only employees with designation Driver can be registered"
        columns={[
          {
            key: 'code',
            label: 'Driver Code',
            render: v => <span className="badge badge-neutral">{v}</span>,
          },
          {
            key: 'name',
            label: 'Employee Name',
            render: v => <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</strong>,
          },
          {
            key: '_estate',
            label: 'Estate',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>,
          },
          {
            key: 'licenseNo',
            label: 'License No.',
            render: v => <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</span>,
          },
          {
            key: '_licCat',
            label: 'License Category',
            render: v => v
              ? (
                <span>
                  <span className="badge badge-primary" style={{ marginRight: 5 }}>{v.code}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.name}</span>
                </span>
              )
              : '—',
          },
          {
            key: 'licExpireDate',
            label: 'Expiry Date',
            render: v => v
              ? <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: '_licStatus',
            label: 'Lic. Status',
            render: v => <span className={`badge ${LIC_STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: v => <span className={`badge ${DRIVER_STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => navigate('/drivers/add')}
        addLabel="Add Driver"
        onEdit={row => navigate(`/drivers/edit/${row.id}`)}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by name, code, license no., estate or status…"
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
              {filtered.length} of {data.length} drivers
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
                  <div className="card-header-title">Remove Driver</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Remove driver record for{' '}
                <strong>{confirmDelete.name}</strong>{' '}
                <span className="badge badge-neutral" style={{ verticalAlign: 'middle' }}>
                  {confirmDelete.code}
                </span>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                License: {confirmDelete.licenseNo}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={handleDelete}>
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
