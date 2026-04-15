/**
 * Report: Asset Net Book Value
 * Route: /reports/asset-nbv
 * ID prefix: rpt-nbv
 *
 * NBV = Asset Value − total posted depreciation (from depreciationHistoryStore)
 * Clamped to residual value as the floor.
 */
import { useState, useMemo } from 'react';
import { fixedAssetStore }        from '../data/fixedAssetStore';
import { depreciationStore }      from '../data/depreciationStore';
import { depreciationHistoryStore } from '../data/depreciationHistoryStore';
import { MOCK }                   from '../data/mockData';
import { ReportShell }            from '../components/ReportShell';
import { exportToCsv }            from '../utils/csvExport';

const ID = 'rpt-nbv';

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function pct(num, denom) {
  if (!denom) return '—';
  return `${Math.round((num / denom) * 100)}%`;
}

export default function ReportAssetNBV() {
  const assets    = fixedAssetStore.getAll();
  const schedules = depreciationStore.getAll();
  const typeMap   = Object.fromEntries(MOCK.fixedAssetTypes.map(t => [t.id, t.name]));
  const catMap    = Object.fromEntries((MOCK.fixedAssetCategories || []).map(c => [c.id, c.name]));
  const estateMap = Object.fromEntries(MOCK.estates.map(e => [e.id, e.name]));

  /* Build a map: assetID → schedule */
  const scheduleByAsset = Object.fromEntries(schedules.map(s => [s.fixedAssetID, s]));

  /* Compute NBV rows */
  const enriched = useMemo(() => assets.map(a => {
    const sched      = scheduleByAsset[a.id];
    const assetValue = sched?.assetValue    ?? a.totalCostOfAsset ?? 0;
    const residual   = sched?.residualValue ?? 0;
    const totalPosted = depreciationHistoryStore.totalPosted(a.id);
    const nbv        = Math.max(residual, assetValue - totalPosted);
    const accDep     = assetValue - nbv;

    return { ...a, _assetValue: assetValue, _residual: residual, _totalPosted: totalPosted, _nbv: nbv, _accDep: accDep };
  }), [assets, scheduleByAsset]);

  const [filterEstateID, setFilterEstateID] = useState('');
  const [filterTypeID,   setFilterTypeID]   = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');

  const rows = useMemo(() => {
    let r = enriched;
    if (filterEstateID) r = r.filter(a => a.estateID === Number(filterEstateID));
    if (filterTypeID)   r = r.filter(a => a.fixedAssetTypeID === Number(filterTypeID));
    if (filterStatus)   r = r.filter(a => a.status === filterStatus);
    return r;
  }, [enriched, filterEstateID, filterTypeID, filterStatus]);

  /* Summary totals */
  const totalAssetValue = rows.reduce((s, a) => s + a._assetValue, 0);
  const totalAccDep     = rows.reduce((s, a) => s + a._accDep, 0);
  const totalNBV        = rows.reduce((s, a) => s + a._nbv, 0);

  function doExport() {
    exportToCsv('asset-net-book-value.csv',
      ['#', 'Asset Code', 'Asset Name', 'Type', 'Category', 'Estate', 'Status', 'Asset Value (Rs.)', 'Acc. Dep. (Rs.)', 'NBV (Rs.)', 'Residual (Rs.)', 'NBV %'],
      rows.map((a, i) => [
        i + 1, a.code, a.name,
        typeMap[a.fixedAssetTypeID] || '',
        catMap[a.fixedAssetCategoryID] || '',
        estateMap[a.estateID] || '',
        a.status,
        a._assetValue,
        a._accDep,
        a._nbv,
        a._residual,
        pct(a._nbv, a._assetValue),
      ])
    );
  }

  const hasFilter = filterEstateID || filterTypeID || filterStatus;

  return (
    <ReportShell
      title="Asset Net Book Value"
      subtitle="Current net book value per asset, computed from posted depreciation history"
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
          <select id={`${ID}-select-status`} className="form-control" style={{ minWidth: 140 }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['Active', 'Disposed', 'Inactive'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasFilter && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm"
              onClick={() => { setFilterEstateID(''); setFilterTypeID(''); setFilterStatus(''); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {assets.length}
          </span>
        </div>
      </div>

      {/* Summary totals */}
      <div className="card-body" style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Asset Value', value: fmtCurrency(totalAssetValue) },
            { label: 'Total Acc. Dep.',   value: fmtCurrency(totalAccDep) },
            { label: 'Total NBV',         value: fmtCurrency(totalNBV),    highlight: true },
          ].map(stat => (
            <div key={stat.label} style={{
              background: stat.highlight ? 'var(--primary-light)' : 'var(--bg-page)',
              borderRadius: 'var(--radius-sm)', padding: '8px 14px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: stat.highlight ? 'var(--primary)' : 'var(--text-primary)' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-body" style={{ padding: '0 20px 20px' }}>
        <div className="table-wrap">
          <table className="data-table" id={`${ID}-table`}>
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Estate</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Asset Value</th>
                <th style={{ textAlign: 'right' }}>Acc. Dep.</th>
                <th style={{ textAlign: 'right' }}>NBV</th>
                <th style={{ textAlign: 'right' }}>Residual</th>
                <th style={{ textAlign: 'right' }}>NBV %</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No records found</td></tr>
              ) : rows.map((a, i) => (
                <tr key={a.id} id={`${ID}-row-${a.id}`}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.code}</td>
                  <td>{a.name}</td>
                  <td>{typeMap[a.fixedAssetTypeID] || '—'}</td>
                  <td>{estateMap[a.estateID] || '—'}</td>
                  <td>
                    <span className={`badge ${a.status === 'Active' ? 'badge-success' : a.status === 'Disposed' ? 'badge-danger' : 'badge-neutral'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(a._assetValue)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--danger)' }}>{fmtCurrency(a._accDep)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--primary)' }}>{fmtCurrency(a._nbv)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{fmtCurrency(a._residual)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(a._nbv, a._assetValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
