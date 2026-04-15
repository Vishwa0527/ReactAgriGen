/**
 * Report: Asset Maintenance Summary
 * Route: /reports/asset-maintenance
 * ID prefix: rpt-am
 */
import { useState, useMemo } from 'react';
import { assetMaintenanceStore } from '../data/assetMaintenanceStore';
import { fixedAssetStore }       from '../data/fixedAssetStore';
import { MOCK }                  from '../data/mockData';
import { ReportShell }           from '../components/ReportShell';
import { exportToCsv }           from '../utils/csvExport';

const ID = 'rpt-am';

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export default function ReportAssetMaintenance() {
  const maintenances = assetMaintenanceStore.getAll();
  const assets       = fixedAssetStore.getAll();
  const assetMap     = Object.fromEntries(assets.map(a => [a.id, a]));
  const workshopMap  = Object.fromEntries(MOCK.workshops.map(w => [w.id, w.name]));
  const estateMap    = Object.fromEntries(MOCK.estates.map(e => [e.id, e.name]));

  const [filterEstateID, setFilterEstateID] = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterFrom,     setFilterFrom]     = useState('');
  const [filterTo,       setFilterTo]       = useState('');

  const rows = useMemo(() => {
    let r = [...maintenances].sort((a, b) => (b.maintenanceDate ?? '').localeCompare(a.maintenanceDate ?? ''));
    if (filterEstateID) r = r.filter(m => m.estateID === Number(filterEstateID));
    if (filterStatus)   r = r.filter(m => m.status   === filterStatus);
    if (filterFrom)     r = r.filter(m => (m.maintenanceDate ?? '') >= filterFrom);
    if (filterTo)       r = r.filter(m => (m.maintenanceDate ?? '') <= filterTo);
    return r;
  }, [maintenances, filterEstateID, filterStatus, filterFrom, filterTo]);

  const totalCost = rows.reduce((s, m) => s + (m.totalMaintenanceCost || 0), 0);

  function doExport() {
    exportToCsv('asset-maintenance-summary.csv',
      ['#', 'Code', 'Asset Name', 'Date', 'Workshop', 'Estate', 'Status', 'Total Cost (Rs.)'],
      rows.map((m, i) => {
        const a = assetMap[m.fixedAssetID];
        return [
          i + 1,
          m.maintenanceCode || '',
          a?.name || `Asset #${m.fixedAssetID}`,
          m.maintenanceDate ? fmtDate(m.maintenanceDate) : '',
          workshopMap[m.workshopID] || '',
          estateMap[m.estateID] || '',
          m.status || '',
          m.totalMaintenanceCost || 0,
        ];
      })
    );
  }

  const hasFilter = filterEstateID || filterStatus || filterFrom || filterTo;

  return (
    <ReportShell
      title="Asset Maintenance Summary"
      subtitle="All asset maintenance events with cost totals and status"
      onExportCsv={doExport}
    >
      {/* Filters */}
      <div className="card-body" style={{ padding: '12px 20px 0' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <select id={`${ID}-select-estate`} className="form-control" style={{ minWidth: 160 }}
            value={filterEstateID} onChange={e => setFilterEstateID(e.target.value)}>
            <option value="">All Estates</option>
            {MOCK.estates.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select id={`${ID}-select-status`} className="form-control" style={{ minWidth: 130 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From</span>
            <input id={`${ID}-input-from`} type="date" className="form-control" style={{ minWidth: 140 }}
              value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To</span>
            <input id={`${ID}-input-to`} type="date" className="form-control" style={{ minWidth: 140 }}
              value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          {hasFilter && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm"
              onClick={() => { setFilterEstateID(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {maintenances.length}
          </span>
        </div>
      </div>

      {/* Total cost callout */}
      {rows.length > 0 && (
        <div className="card-body" style={{ padding: '0 20px 12px' }}>
          <div style={{ display: 'inline-block', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: '8px 14px' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Maintenance Cost</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>{fmtCurrency(totalCost)}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card-body" style={{ padding: '0 20px 20px' }}>
        <div className="table-wrap">
          <table className="data-table" id={`${ID}-table`}>
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th>Asset Name</th>
                <th>Date</th>
                <th>Workshop</th>
                <th>Estate</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No records found</td></tr>
              ) : rows.map((m, i) => {
                const a = assetMap[m.fixedAssetID];
                return (
                  <tr key={m.id} id={`${ID}-row-${m.id}`}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.maintenanceCode}</td>
                    <td>{a?.name || `Asset #${m.fixedAssetID}`}</td>
                    <td>{fmtDate(m.maintenanceDate)}</td>
                    <td>{workshopMap[m.workshopID] || '—'}</td>
                    <td>{estateMap[m.estateID] || '—'}</td>
                    <td>
                      <span className={`badge ${m.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                        {m.status || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmtCurrency(m.totalMaintenanceCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
