import { useState, useMemo } from 'react';
import { vehicleStore } from '../data/vehicleStore';
import { MOCK, nameOf } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { Icon } from '../components/Icon';

const ID = 'vh';

const ACTION_BADGE = {
  Created: 'badge-success',
  Updated: 'badge-info',
};

const STATUS_BADGE = {
  'Active':      'badge-success',
  'In Service':  'badge-info',
  'Maintenance': 'badge-warning',
  'Inactive':    'badge-danger',
};

function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function VehicleHistory() {
  /* History is sourced directly from vehicleStore — read-only */
  const [history] = useState(() =>
    vehicleStore.getHistory().map(h => ({
      ...h,
      /* Computed display fields so ListingPage columns can use simple keys */
      regNumber:  h.snapshot?.numbers  ?? `#${h.vehicleID}`,
      brandModel: `${h.snapshot?.brand ?? ''} ${h.snapshot?.model ?? ''}`.trim(),
      snapStatus: h.snapshot?.status   ?? '—',
      snapEstate: nameOf.estate(h.snapshot?.estateID),
    }))
  );

  const [filterVehicleID, setFilterVehicleID] = useState('');
  const [viewSnapshot, setViewSnapshot]       = useState(null);   // for snapshot detail modal

  const filtered = useMemo(() => {
    if (!filterVehicleID) return history;
    return history.filter(h => h.vehicleID === Number(filterVehicleID));
  }, [history, filterVehicleID]);

  /* All vehicles that appear in history (for filter dropdown) */
  const vehiclesInHistory = useMemo(() => {
    const ids = [...new Set(history.map(h => h.vehicleID))];
    return ids.map(id => {
      const snap = history.find(h => h.vehicleID === id)?.snapshot;
      return { id, label: snap ? `${snap.numbers} — ${snap.brand} ${snap.model}` : `Vehicle #${id}` };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [history]);

  return (
    <>
      <ListingPage
        idPrefix={ID}
        title="Vehicle History"
        subtitle="Audit log of all vehicle create and update operations — changes are recorded automatically on every save"
        columns={[
          {
            key: 'timestamp',
            label: 'Date & Time',
            render: v => (
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                {fmtDateTime(v)}
              </span>
            ),
          },
          {
            key: 'regNumber',
            label: 'Reg. No.',
            render: v => <span className="badge badge-primary">{v}</span>,
          },
          {
            key: 'brandModel',
            label: 'Brand / Model',
            render: v => <span style={{ fontSize: 13 }}>{v || '—'}</span>,
          },
          {
            key: 'action',
            label: 'Action',
            render: v => <span className={`badge ${ACTION_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
          {
            key: 'snapStatus',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
          {
            key: 'snapEstate',
            label: 'Estate',
            render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>,
          },
          {
            key: 'id',
            label: 'Snapshot',
            render: (v, row) => (
              <button
                id={`${ID}-btn-view-${v}`}
                className="btn-icon"
                title="View full snapshot"
                onClick={() => setViewSnapshot(row.snapshot)}
              >
                <Icon name="eye" style={{ width: 15, height: 15 }} />
              </button>
            ),
          },
        ]}
        data={filtered}
        /* No onAdd / onEdit / onDelete — read-only view */
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="form-group" style={{ minWidth: 280, marginBottom: 0 }}>
              <select
                id={`${ID}-select-vehicle-filter`}
                className="form-control"
                value={filterVehicleID}
                onChange={e => setFilterVehicleID(e.target.value)}
              >
                <option value="">— All Vehicles —</option>
                {vehiclesInHistory.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>
            {filterVehicleID && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => setFilterVehicleID('')}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {history.length} entries
            </span>
          </div>
        }
      />

      {/* ── Snapshot Detail Modal (read-only) ── */}
      {viewSnapshot && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div>
                <div className="card-header-title">Vehicle Snapshot</div>
                <div className="card-header-sub">
                  {viewSnapshot.numbers} — {viewSnapshot.brand} {viewSnapshot.model}
                </div>
              </div>
              <button
                id={`${ID}-btn-snapshot-close`}
                className="btn-icon"
                onClick={() => setViewSnapshot(null)}
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="card-body" style={{ overflowY: 'auto' }}>
              {/* Identity */}
              <p className="section-label">Vehicle Identity</p>
              <div className="form-grid form-grid-3" style={{ marginBottom: 16 }}>
                {[
                  ['Registration No.', viewSnapshot.numbers],
                  ['Brand',            viewSnapshot.brand],
                  ['Model',            viewSnapshot.model],
                  ['Capacity',         viewSnapshot.capacity || '—'],
                  ['Register Year',    viewSnapshot.registerYear || '—'],
                  ['Status',           viewSnapshot.status],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '8px 12px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>

              <hr className="divider" style={{ margin: '12px 0' }} />

              {/* Scope & Classification */}
              <p className="section-label">Scope & Classification</p>
              <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
                {[
                  ['Group',            nameOf.group(viewSnapshot.groupID)],
                  ['Estate',           nameOf.estate(viewSnapshot.estateID)],
                  ['Vehicle Type',     nameOf.vehicleType(viewSnapshot.vehicleTypeID)],
                  ['Fixed Asset Type', nameOf.fixedAsset(viewSnapshot.fixedAssetTypeID)],
                  ['Primary Fuel',     nameOf.fuelType(viewSnapshot.fuelTypeID)],
                  ['Secondary Fuel',   viewSnapshot.secondaryFuelTypeID ? nameOf.fuelType(viewSnapshot.secondaryFuelTypeID) : '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '8px 12px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>

              <hr className="divider" style={{ margin: '12px 0' }} />

              {/* Financials */}
              <p className="section-label">Financial & Depreciation</p>
              <div className="form-grid form-grid-4">
                {[
                  ['Cost of Asset',      viewSnapshot.costOfAsset       ? `Rs. ${Number(viewSnapshot.costOfAsset).toLocaleString('en-LK')}` : '—'],
                  ['Useful Life',        viewSnapshot.usefulLifeYears   ? `${viewSnapshot.usefulLifeYears} yrs` : '—'],
                  ['Residual Value',     viewSnapshot.residualValue     ? `Rs. ${Number(viewSnapshot.residualValue).toLocaleString('en-LK')}` : '—'],
                  ['Depreciation / yr',  viewSnapshot.depreciationValue ? `Rs. ${Number(viewSnapshot.depreciationValue).toLocaleString('en-LK')}` : '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '8px 12px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-footer">
              <button
                id={`${ID}-btn-snapshot-dismiss`}
                className="btn btn-secondary"
                onClick={() => setViewSnapshot(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
