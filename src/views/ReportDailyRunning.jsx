/**
 * Report: Daily Running Log
 * Route: /reports/daily-running
 * ID prefix: rpt-dr
 */
import { useState, useMemo } from 'react';
import { dailyRunningStore }   from '../data/dailyRunningStore';
import { vehicleStore }        from '../data/vehicleStore';
import { driverStore }         from '../data/driverStore';
import { ReportShell }         from '../components/ReportShell';
import { exportToCsv }         from '../utils/csvExport';

const ID = 'rpt-dr';

function fmtDate(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt.replace(' ', 'T')).toLocaleDateString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dt; }
}

function fmtTime(dt) {
  if (!dt) return '—';
  return dt.split(/[ T]/)[1]?.slice(0, 5) ?? '—';
}

function calcKm(startOdo, endOdo) {
  const s = Number(startOdo), e = Number(endOdo);
  if (!s || !e || e <= s) return null;
  return e - s;
}

function calcDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end.replace(' ', 'T')) - new Date(start.replace(' ', 'T'));
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ReportDailyRunning() {
  const runs       = dailyRunningStore.getAll();
  const vehicles   = vehicleStore.getAll();
  const drivers    = driverStore.getAll();
  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));
  const driverMap  = Object.fromEntries(drivers.map(d => [d.id, d]));

  const [filterVehicleID, setFilterVehicleID] = useState('');
  const [filterDriverID,  setFilterDriverID]  = useState('');
  const [filterFrom,      setFilterFrom]      = useState('');
  const [filterTo,        setFilterTo]        = useState('');

  const rows = useMemo(() => {
    let r = [...runs];
    if (filterVehicleID) r = r.filter(x => x.vehicleID === Number(filterVehicleID));
    if (filterDriverID)  r = r.filter(x => x.driverID  === Number(filterDriverID));
    if (filterFrom) r = r.filter(x => (x.startDateTime?.slice(0, 10) ?? '') >= filterFrom);
    if (filterTo)   r = r.filter(x => (x.startDateTime?.slice(0, 10) ?? '') <= filterTo);
    return r;
  }, [runs, filterVehicleID, filterDriverID, filterFrom, filterTo]);

  const totalKm = rows.reduce((s, r) => {
    const km = calcKm(r.startOdo, r.endOdo);
    return km ? s + km : s;
  }, 0);

  function doExport() {
    exportToCsv('daily-running-log.csv',
      ['#', 'Ref Code', 'Vehicle', 'Reg. No.', 'Driver', 'Date', 'Start Time', 'End Time', 'Start Odo', 'End Odo', 'KM Covered'],
      rows.map((r, i) => {
        const v  = vehicleMap[r.vehicleID];
        const d  = driverMap[r.driverID];
        const km = calcKm(r.startOdo, r.endOdo);
        return [
          i + 1,
          r.refCode || '',
          v ? `${v.brand} ${v.model}` : `Vehicle #${r.vehicleID}`,
          v?.numbers || '',
          d?.name || `Driver #${r.driverID}`,
          r.startDateTime ? fmtDate(r.startDateTime) : '',
          r.startDateTime ? fmtTime(r.startDateTime) : '',
          r.endDateTime   ? fmtTime(r.endDateTime)   : '',
          r.startOdo ?? '',
          r.endOdo   ?? '',
          km ?? '',
        ];
      })
    );
  }

  const hasFilter = filterVehicleID || filterDriverID || filterFrom || filterTo;

  return (
    <ReportShell
      title="Daily Running Log"
      subtitle="Trip-by-trip odometer records with mileage and duration"
      onExportCsv={doExport}
    >
      {/* Filters */}
      <div className="card-body" style={{ padding: '12px 20px 0' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <select id={`${ID}-select-vehicle`} className="form-control" style={{ minWidth: 180 }}
            value={filterVehicleID} onChange={e => setFilterVehicleID(e.target.value)}>
            <option value="">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.numbers}</option>
            ))}
          </select>
          <select id={`${ID}-select-driver`} className="form-control" style={{ minWidth: 160 }}
            value={filterDriverID} onChange={e => setFilterDriverID(e.target.value)}>
            <option value="">All Drivers</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
              onClick={() => { setFilterVehicleID(''); setFilterDriverID(''); setFilterFrom(''); setFilterTo(''); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {runs.length}
          </span>
        </div>
      </div>

      {/* Total KM callout */}
      {rows.length > 0 && (
        <div className="card-body" style={{ padding: '0 20px 12px' }}>
          <div style={{ display: 'inline-block', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: '8px 14px' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total KM Covered</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
              {totalKm.toLocaleString('en-LK')} km
            </div>
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
                <th>Ref Code</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Date</th>
                <th>Start</th>
                <th>End</th>
                <th style={{ textAlign: 'right' }}>Start Odo</th>
                <th style={{ textAlign: 'right' }}>End Odo</th>
                <th style={{ textAlign: 'right' }}>KM</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No records found</td></tr>
              ) : rows.map((r, i) => {
                const v  = vehicleMap[r.vehicleID];
                const d  = driverMap[r.driverID];
                const km = calcKm(r.startOdo, r.endOdo);
                return (
                  <tr key={r.id} id={`${ID}-row-${r.id}`}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.refCode}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{v ? `${v.brand} ${v.model}` : `#${r.vehicleID}`}</div>
                      {v && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.numbers}</div>}
                    </td>
                    <td>{d?.name || `Driver #${r.driverID}`}</td>
                    <td>{fmtDate(r.startDateTime)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.startDateTime)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.endDateTime)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.startOdo != null ? r.startOdo.toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.endOdo != null ? r.endOdo.toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {km != null ? `${km} km` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {calcDuration(r.startDateTime, r.endDateTime) || '—'}
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
