import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { fixedAssetTypeStore } from '../data/fixedAssetTypeStore';
import { fixedAssetCategoryStore } from '../data/fixedAssetCategoryStore';
import { depreciationStore } from '../data/depreciationStore';
import { depreciationHistoryStore } from '../data/depreciationHistoryStore';
import { assetMaintenanceStore } from '../data/assetMaintenanceStore';
import { estimationStore } from '../data/estimationStore';
import { fixedAssetHistoryStore } from '../data/fixedAssetHistoryStore';
import { MOCK, nameOf } from '../data/mockData';
import { Icon } from '../components/Icon';

const ID = 'fad';

function fmtCurrency(v) {
  return `Rs. ${Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function StatCard({ icon, iconClass, value, label, sub, onClick }) {
  return (
    <div className="summary-card" style={onClick ? { cursor: 'pointer' } : {}} onClick={onClick}>
      <div className={`summary-card-icon ${iconClass}`}><Icon name={icon} /></div>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-label">{label}</div>
      {sub && <div className="summary-card-trend">{sub}</div>}
    </div>
  );
}

export default function FixedAssetDashboard() {
  const navigate = useNavigate();

  const [assets]       = useState(() => fixedAssetStore.getAll());
  const [assetTypes]   = useState(() => fixedAssetTypeStore.getAll());
  const [categories]   = useState(() => fixedAssetCategoryStore.getAll());
  const [schedules]    = useState(() => depreciationStore.getAll());
  const [maintenances] = useState(() => assetMaintenanceStore.getAll());
  const [estimations]  = useState(() => estimationStore.getAll());
  const [history]      = useState(() => fixedAssetHistoryStore.getAll());

  /* ── KPI Calculations ── */
  const totalAssets     = assets.length;
  const activeAssets    = assets.filter(a => a.status === 'Active').length;
  const totalCost       = assets.reduce((s, a) => s + (a.totalCostOfAsset || 0), 0);
  const totalDepAnnual  = schedules.reduce((s, d) => s + (d.depreciationValue || 0), 0);
  const totalMaintCost  = maintenances.reduce((s, m) => s + (m.totalMaintenanceCost || 0), 0);
  const pendingEst      = estimations.filter(e => e.status === 'Pending').length;
  const warrantyActive  = assets.filter(a => a.isWarrantyEnabled && a.warrantyEndDate && a.warrantyEndDate >= new Date().toISOString().slice(0, 10)).length;

  /* Book value from depreciation posting */
  const totalBookValue = schedules.reduce((sum, s) => {
    const posted = depreciationHistoryStore.totalPostedForSchedule(s.id);
    return sum + Math.max(s.residualValue || 0, (s.assetValue || 0) - posted);
  }, 0);

  /* ── Assets by Type ── */
  const byType = useMemo(() =>
    assetTypes.map(t => ({
      ...t,
      count: assets.filter(a => a.fixedAssetTypeID === t.id).length,
      totalValue: assets.filter(a => a.fixedAssetTypeID === t.id).reduce((s, a) => s + (a.totalCostOfAsset || 0), 0),
    })).filter(t => t.count > 0),
    [assetTypes, assets]
  );

  /* ── Assets by Category ── */
  const byCategory = useMemo(() =>
    categories.map(c => ({
      ...c,
      count: assets.filter(a => a.fixedAssetCategoryID === c.id).length,
      totalValue: assets.filter(a => a.fixedAssetCategoryID === c.id).reduce((s, a) => s + (a.totalCostOfAsset || 0), 0),
    })).filter(c => c.count > 0),
    [categories, assets]
  );

  /* ── Assets by Estate ── */
  const byEstate = useMemo(() => {
    const estateMap = {};
    assets.forEach(a => {
      const key = a.estateID;
      if (!estateMap[key]) estateMap[key] = { estateID: key, name: nameOf.estate(key), count: 0, totalValue: 0 };
      estateMap[key].count++;
      estateMap[key].totalValue += (a.totalCostOfAsset || 0);
    });
    return Object.values(estateMap).sort((a, b) => b.totalValue - a.totalValue);
  }, [assets]);

  /* ── Recent History ── */
  const recentHistory = useMemo(() =>
    [...history].sort((a, b) => (b.changeDate ?? '').localeCompare(a.changeDate ?? '')).slice(0, 5),
    [history]
  );

  /* ── Top 5 Most Valuable Assets ── */
  const topAssets = useMemo(() =>
    [...assets].sort((a, b) => (b.totalCostOfAsset || 0) - (a.totalCostOfAsset || 0)).slice(0, 5),
    [assets]
  );

  /* Max value for bar chart scaling */
  const maxAssetValue = topAssets.length > 0 ? topAssets[0].totalCostOfAsset : 1;

  const CHANGE_BADGE = {
    'Initial Registration': 'badge-success',
    'Revaluation':          'badge-info',
    'Maintenance Impact':   'badge-warning',
    'Disposal':             'badge-danger',
  };

  return (
    <div className="fade-up">
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">Fixed Assets Dashboard</h1>
          <p className="page-subtitle">Consolidated view of all fixed asset metrics</p>
        </div>
      </div>

      {/* ── Row 1: Primary KPIs ── */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <StatCard icon="box" iconClass="teal" value={totalAssets} label="Total Assets"
          sub={`${activeAssets} active`} onClick={() => navigate('/assets-register')} />
        <StatCard icon="dollar" iconClass="blue" value={fmtCurrency(totalCost)} label="Total Asset Cost" />
        <StatCard icon="chart" iconClass="amber" value={fmtCurrency(totalBookValue)} label="Current Book Value" />
        <StatCard icon="chart" iconClass="red" value={fmtCurrency(totalDepAnnual)} label="Annual Depreciation" />
      </div>

      {/* ── Row 2: Secondary KPIs ── */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <StatCard icon="wrench" iconClass="purple" value={maintenances.length} label="Maintenance Records"
          sub={fmtCurrency(totalMaintCost)} onClick={() => navigate('/asset-maintenance')} />
        <StatCard icon="clipboard" iconClass="blue" value={estimations.length} label="Estimations"
          sub={pendingEst > 0 ? `${pendingEst} pending` : 'all processed'} onClick={() => navigate('/estimations')} />
        <StatCard icon="check" iconClass="teal" value={warrantyActive} label="Under Warranty" />
        <StatCard icon="history" iconClass="amber" value={history.length} label="History Snapshots"
          onClick={() => navigate('/asset-history')} />
      </div>

      {/* ── Row 3: Breakdown Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>

        {/* Assets by Type */}
        <div className="card" id={`${ID}-card-byType`}>
          <div className="card-header">
            <div>
              <div className="card-header-title">Assets by Type</div>
              <div className="card-header-sub">{byType.length} types with assets</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {byType.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, flexShrink: 0,
                }}>{t.count}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtCurrency(t.totalValue)}</div>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${totalCost > 0 ? (t.totalValue / totalCost) * 100 : 0}%`,
                      height: '100%', background: 'var(--primary)', borderRadius: 3,
                      transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'right' }}>
                  {totalCost > 0 ? ((t.totalValue / totalCost) * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Assets by Category */}
        <div className="card" id={`${ID}-card-byCategory`}>
          <div className="card-header">
            <div>
              <div className="card-header-title">Assets by Category</div>
              <div className="card-header-sub">{byCategory.length} categories</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {byCategory.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
              }}>
                <span className="badge badge-neutral" style={{ fontSize: 10, minWidth: 60, textAlign: 'center' }}>{c.code}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-dark)' }}>{c.count}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 100, textAlign: 'right' }}>{fmtCurrency(c.totalValue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assets by Estate */}
        <div className="card" id={`${ID}-card-byEstate`}>
          <div className="card-header">
            <div>
              <div className="card-header-title">Assets by Estate</div>
              <div className="card-header-sub">Distribution across estates</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {byEstate.map(e => (
              <div key={e.estateID} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                  background: '#dbeafe', color: '#1e40af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, flexShrink: 0,
                }}>{e.count}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtCurrency(e.totalValue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Most Valuable */}
        <div className="card" id={`${ID}-card-topAssets`}>
          <div className="card-header">
            <div>
              <div className="card-header-title">Top 5 Most Valuable Assets</div>
              <div className="card-header-sub">By original acquisition cost</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {topAssets.map((a, idx) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/assets-register/edit/${a.id}`)}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#d97706' : '#e2e8f0',
                  color: idx < 3 ? '#fff' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                }}>{idx + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {a.code} · {nameOf.fixedAssetType(a.fixedAssetTypeID)}
                  </div>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(a.totalCostOfAsset / maxAssetValue) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary), var(--primary-mid))',
                      borderRadius: 4, transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-dark)', minWidth: 110, textAlign: 'right' }}>
                  {fmtCurrency(a.totalCostOfAsset)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Recent Activity ── */}
      <div className="card" id={`${ID}-card-recentHistory`} style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-header-title">Recent Asset Activity</div>
            <div className="card-header-sub">Latest change history snapshots</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/asset-history')}>
            View All <Icon name="chevron" style={{ width: 12, height: 12 }} />
          </button>
        </div>
        {recentHistory.length === 0 ? (
          <div className="card-body">
            <div className="empty-state"><Icon name="history" /><p>No activity recorded yet.</p></div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" id={`${ID}-table-recent`}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Change</th>
                  <th>Asset</th>
                  <th>Present Value</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(h.changeDate)}</td>
                    <td><span className={`badge ${CHANGE_BADGE[h.changeType] ?? 'badge-neutral'}`}>{h.changeType}</span></td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--primary-dark)' }}>{h.fixedAssetCode}</span>
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.fixedAssetName}</span>
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{h.presentValue ? fmtCurrency(h.presentValue) : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {h.newUsefulLifeYears && <span>Life → {h.newUsefulLifeYears} yrs</span>}
                      {h.warrantyClaimDate && <span>Warranty: {fmtDate(h.warrantyClaimDate)}</span>}
                      {!h.newUsefulLifeYears && !h.warrantyClaimDate && <span style={{ fontStyle: 'italic' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
