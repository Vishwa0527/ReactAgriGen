/**
 * Report: Fleet Register
 * Route: /reports/fleet-register
 * ID prefix: rpt-fr
 */
import { useState, useMemo } from 'react';
import { vehicleStore } from '../data/vehicleStore';
import { MOCK }         from '../data/mockData';
import { ReportShell }  from '../components/ReportShell';
import { exportToCsv }  from '../utils/csvExport';

const ID = 'rpt-fr';

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

const STATUS_BADGE = { Active: 'badge-success', 'In Service': 'badge-warning', Maintenance: 'badge-danger', Inactive: 'badge-neutral' };

export default function ReportFleetRegister() {
  const vehicles  = vehicleStore.getAll();
  const typeMap   = Object.fromEntries(MOCK.vehicleTypes.map(t => [t.id, t.name]));
  const groupMap  = Object.fromEntries(MOCK.groups.map(g => [g.id, g.name]));
  const estateMap = Object.fromEntries(MOCK.estates.map(e => [e.id, e.name]));

  const [filterEstateID, setFilterEstateID] = useState('');
  const [filterTypeID,   setFilterTypeID]   = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');

  const rows = useMemo(() => {
    let r = vehicles;
    if (filterEstateID) r = r.filter(v => v.estateID  === Number(filterEstateID));
    if (filterTypeID)   r = r.filter(v => v.vehicleTypeID === Number(filterTypeID));
    if (filterStatus)   r = r.filter(v => v.status    === filterStatus);
    return r;
  }, [vehicles, filterEstateID, filterTypeID, filterStatus]);

  function doExport() {
    exportToCsv('fleet-register.csv',
      ['#', 'Reg. No.', 'Brand', 'Model', 'Type', 'Group', 'Estate', 'Status', 'Register Year', 'Cost (Rs.)'],
      rows.map((v, i) => [
        i + 1, v.numbers, v.brand, v.model,
        typeMap[v.vehicleTypeID]  || '',
        groupMap[v.groupID]       || '',
        estateMap[v.estateID]     || '',
        v.status,
        v.registerYear ? new Date(v.registerYear).getFullYear() : '',
        v.costOfAsset || '',
      ])
    );
  }

  const hasFilter = filterEstateID || filterTypeID || filterStatus;

  return (
    <ReportShell
      title="Fleet Register"
      subtitle="Complete vehicle register with type, estate, status and cost details"
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
          <select id={`${ID}-select-type`} className="form-control" style={{ minWidth: 160 }}
            value={filterTypeID} onChange={e => setFilterTypeID(e.target.value)}>
            <option value="">All Vehicle Types</option>
            {MOCK.vehicleTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select id={`${ID}-select-status`} className="form-control" style={{ minWidth: 140 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['Active', 'In Service', 'Maintenance', 'Inactive'].map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
          {hasFilter && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm"
              onClick={() => { setFilterEstateID(''); setFilterTypeID(''); setFilterStatus(''); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {vehicles.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card-body" style={{ padding: '0 20px 20px' }}>
        <div className="table-wrap">
          <table className="data-table" id={`${ID}-table`}>
            <thead>
              <tr>
                <th>#</th>
                <th>Reg. No.</th>
                <th>Brand / Model</th>
                <th>Type</th>
                <th>Group</th>
                <th>Estate</th>
                <th>Status</th>
                <th>Register Year</th>
                <th style={{ textAlign: 'right' }}>Cost (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No records found</td></tr>
              ) : rows.map((v, i) => (
                <tr key={v.id} id={`${ID}-row-${v.id}`}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{v.numbers}</td>
                  <td>{v.brand} {v.model}</td>
                  <td>{typeMap[v.vehicleTypeID]  || '—'}</td>
                  <td>{groupMap[v.groupID]       || '—'}</td>
                  <td>{estateMap[v.estateID]     || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[v.status] || 'badge-neutral'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td>{v.registerYear ? fmtDate(v.registerYear) : '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(v.costOfAsset)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
