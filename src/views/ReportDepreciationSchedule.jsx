/**
 * Report: Depreciation Schedule
 * Route: /reports/depreciation-schedule
 * ID prefix: rpt-ds
 */
import { useState, useMemo } from 'react';
import { depreciationStore } from '../data/depreciationStore';
import { fixedAssetStore }   from '../data/fixedAssetStore';
import { MOCK }              from '../data/mockData';
import { ReportShell }       from '../components/ReportShell';
import { exportToCsv }       from '../utils/csvExport';

const ID = 'rpt-ds';

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function scheduleEndDate(assetValueDate, usefulYears) {
  if (!assetValueDate || !usefulYears) return null;
  const d = new Date(assetValueDate);
  d.setFullYear(d.getFullYear() + Number(usefulYears));
  return d.toISOString().slice(0, 10);
}

export default function ReportDepreciationSchedule() {
  const schedules  = depreciationStore.getAll();
  const assets     = fixedAssetStore.getAll();
  const assetMap   = Object.fromEntries(assets.map(a => [a.id, a]));
  const typeMap    = Object.fromEntries(MOCK.fixedAssetTypes.map(t => [t.id, t.name]));
  const estateMap  = Object.fromEntries(MOCK.estates.map(e => [e.id, e.name]));

  const [filterEstateID, setFilterEstateID] = useState('');
  const [filterTypeID,   setFilterTypeID]   = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');

  const rows = useMemo(() => {
    let r = schedules;
    if (filterEstateID) r = r.filter(s => s.estateID === Number(filterEstateID));
    if (filterStatus)   r = r.filter(s => s.status   === filterStatus);
    if (filterTypeID) {
      r = r.filter(s => {
        const a = assetMap[s.fixedAssetID];
        return a?.fixedAssetTypeID === Number(filterTypeID);
      });
    }
    return r;
  }, [schedules, filterEstateID, filterStatus, filterTypeID, assetMap]);

  function doExport() {
    exportToCsv('depreciation-schedule.csv',
      ['#', 'Asset Code', 'Asset Name', 'Asset Type', 'Estate', 'Asset Value (Rs.)', 'Residual (Rs.)', 'Useful Years', 'Annual Dep. (Rs.)', 'Start Date', 'Schedule End', 'Status'],
      rows.map((s, i) => {
        const a   = assetMap[s.fixedAssetID];
        const end = scheduleEndDate(s.assetValueDate, s.usefulYears);
        return [
          i + 1,
          a?.code || '',
          a?.name || `Asset #${s.fixedAssetID}`,
          typeMap[a?.fixedAssetTypeID] || '',
          estateMap[s.estateID] || '',
          s.assetValue       || 0,
          s.residualValue    || 0,
          s.usefulYears      || 0,
          s.depreciationValue || 0,
          s.assetValueDate   ? fmtDate(s.assetValueDate) : '',
          end                ? fmtDate(end) : '',
          s.status,
        ];
      })
    );
  }

  const hasFilter = filterEstateID || filterTypeID || filterStatus;

  return (
    <ReportShell
      title="Depreciation Schedule"
      subtitle="Active and closed depreciation schedules with annual rate and end dates"
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
          <select id={`${ID}-select-type`} className="form-control" style={{ minWidth: 180 }}
            value={filterTypeID} onChange={e => setFilterTypeID(e.target.value)}>
            <option value="">All Asset Types</option>
            {MOCK.fixedAssetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select id={`${ID}-select-status`} className="form-control" style={{ minWidth: 130 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
          </select>
          {hasFilter && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm"
              onClick={() => { setFilterEstateID(''); setFilterTypeID(''); setFilterStatus(''); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {schedules.length}
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
                <th>Asset Code</th>
                <th>Asset Name</th>
                <th>Estate</th>
                <th style={{ textAlign: 'right' }}>Asset Value</th>
                <th style={{ textAlign: 'right' }}>Residual</th>
                <th style={{ textAlign: 'center' }}>Useful Yrs</th>
                <th style={{ textAlign: 'right' }}>Annual Dep.</th>
                <th>Start Date</th>
                <th>Schedule End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No records found</td></tr>
              ) : rows.map((s, i) => {
                const a   = assetMap[s.fixedAssetID];
                const end = scheduleEndDate(s.assetValueDate, s.usefulYears);
                return (
                  <tr key={s.id} id={`${ID}-row-${s.id}`}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a?.code || '—'}</td>
                    <td>{a?.name || `Asset #${s.fixedAssetID}`}</td>
                    <td>{estateMap[s.estateID] || '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(s.assetValue)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(s.residualValue)}</td>
                    <td style={{ textAlign: 'center' }}>{s.usefulYears}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtCurrency(s.depreciationValue)}</td>
                    <td>{fmtDate(s.assetValueDate)}</td>
                    <td>{end ? fmtDate(end) : '—'}</td>
                    <td>
                      <span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                        {s.status}
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
