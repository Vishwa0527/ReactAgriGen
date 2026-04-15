/**
 * Report: Driver Assignment History
 * Route: /reports/driver-assignments
 * ID prefix: rpt-da
 */
import { useState, useMemo } from 'react';
import { driverAssignmentStore } from '../data/driverAssignmentStore';
import { vehicleStore }          from '../data/vehicleStore';
import { driverStore }           from '../data/driverStore';
import { MOCK }                  from '../data/mockData';
import { ReportShell }           from '../components/ReportShell';
import { exportToCsv }           from '../utils/csvExport';

const ID = 'rpt-da';

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default function ReportDriverAssignments() {
  const assignments = driverAssignmentStore.getAll();
  const vehicles    = vehicleStore.getAll();
  const drivers     = driverStore.getAll();
  const vehicleMap  = Object.fromEntries(vehicles.map(v => [v.id, v]));
  const driverMap   = Object.fromEntries(drivers.map(d => [d.id, d]));
  const licCatMap   = Object.fromEntries(MOCK.licenseCategories.map(l => [l.id, `${l.code} — ${l.name}`]));
  const estateMap   = Object.fromEntries(MOCK.estates.map(e => [e.id, e.name]));

  const [filterEstateID, setFilterEstateID] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  const rows = useMemo(() => {
    let r = [...assignments].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
    if (filterEstateID) {
      r = r.filter(a => {
        const v = vehicleMap[a.vehicleID];
        return v?.estateID === Number(filterEstateID);
      });
    }
    if (filterActiveOnly) r = r.filter(a => !a.endDate);
    return r;
  }, [assignments, filterEstateID, filterActiveOnly, vehicleMap]);

  function doExport() {
    exportToCsv('driver-assignment-history.csv',
      ['#', 'Vehicle', 'Reg. No.', 'Estate', 'Driver', 'Licence No.', 'Licence Category', 'Start Date', 'End Date', 'Status'],
      rows.map((a, i) => {
        const v = vehicleMap[a.vehicleID];
        const d = driverMap[a.driverID];
        return [
          i + 1,
          v ? `${v.brand} ${v.model}` : `Vehicle #${a.vehicleID}`,
          v?.numbers || '',
          estateMap[v?.estateID] || '',
          d?.name || `Driver #${a.driverID}`,
          d?.licenseNo || '',
          d ? (licCatMap[d.licenseCategoryID] || '') : '',
          a.startDate ? fmtDate(a.startDate) : '',
          a.endDate   ? fmtDate(a.endDate)   : '',
          a.endDate ? 'Closed' : 'Active',
        ];
      })
    );
  }

  const hasFilter = filterEstateID || filterActiveOnly;

  return (
    <ReportShell
      title="Driver Assignment History"
      subtitle="All driver-to-vehicle assignments with active/closed status"
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              id={`${ID}-chk-active`}
              type="checkbox"
              checked={filterActiveOnly}
              onChange={e => setFilterActiveOnly(e.target.checked)}
            />
            Active assignments only
          </label>
          {hasFilter && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm"
              onClick={() => { setFilterEstateID(''); setFilterActiveOnly(false); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {assignments.length}
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
                <th>Vehicle</th>
                <th>Reg. No.</th>
                <th>Estate</th>
                <th>Driver</th>
                <th>Licence No.</th>
                <th>Licence Category</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No records found</td></tr>
              ) : rows.map((a, i) => {
                const v = vehicleMap[a.vehicleID];
                const d = driverMap[a.driverID];
                const isActive = !a.endDate;
                return (
                  <tr key={a.id} id={`${ID}-row-${a.id}`}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td>{v ? `${v.brand} ${v.model}` : `Vehicle #${a.vehicleID}`}</td>
                    <td style={{ fontWeight: 600 }}>{v?.numbers || '—'}</td>
                    <td>{estateMap[v?.estateID] || '—'}</td>
                    <td>{d?.name || `Driver #${a.driverID}`}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d?.licenseNo || '—'}</td>
                    <td>{d ? (licCatMap[d.licenseCategoryID] || '—') : '—'}</td>
                    <td>{fmtDate(a.startDate)}</td>
                    <td>{a.endDate ? fmtDate(a.endDate) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      <span className={`badge ${isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {isActive ? 'Active' : 'Closed'}
                      </span>
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
