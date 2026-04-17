/**
 * GL Approval Queue — aggregated list of all records with
 * GLApprovalStatus === 'PendingApproval' across every GL-enabled module.
 *
 * This screen is a navigator: Finance can see everything pending and click
 * "Review →" to open the source record and approve/reject from there.
 * (Modal-based screens link to the listing; a note prompts the user to find
 * the specific record.)
 */

import { useState, useMemo }     from 'react';
import { useNavigate }           from 'react-router-dom';
import { fixedAssetStore }        from '../data/fixedAssetStore';
import { assetDisposalStore }     from '../data/assetDisposalStore';
import { assetMaintenanceStore }  from '../data/assetMaintenanceStore';
import { maintenanceRecordStore } from '../data/maintenanceRecordStore';
import { vehicleServiceStore }    from '../data/vehicleServiceStore';
import { depreciationHistoryStore } from '../data/depreciationHistoryStore';
import { Icon }                   from '../components/Icon';

const ID = 'glq';

const MODULE_BADGE = { FA: 'badge-info', FLEET: 'badge-success' };

function fmtCurrency(v) {
  if (v == null) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default function GLApprovalQueue() {
  const navigate = useNavigate();
  const [filterModule, setFilterModule] = useState('');

  const items = useMemo(() => {
    const list = [];

    /* 1 — Fixed Asset Capitalizations */
    fixedAssetStore.getAll()
      .filter(a => a.GLApprovalStatus === 'PendingApproval')
      .forEach(a => list.push({
        key:         `fa-${a.id}`,
        moduleCode:  'FA',
        moduleLabel: 'Fixed Asset',
        typeName:    'FA Capitalization',
        reference:   a.code ?? `FA-${a.id}`,
        description: a.name ?? '—',
        amount:      Number(a.totalCostOfAsset) || null,
        date:        a.startDate ?? a.purchaseDate ?? null,
        path:        `/assets-register/edit/${a.id}`,
        modal:       false,
      }));

    /* 2 — Asset Disposals */
    assetDisposalStore.getAll()
      .filter(d => d.GLApprovalStatus === 'PendingApproval')
      .forEach(d => list.push({
        key:         `disp-${d.id}`,
        moduleCode:  'FA',
        moduleLabel: 'Fixed Asset',
        typeName:    'Asset Disposal',
        reference:   d.disposalCode,
        description: `${d.disposalType} — ${fmtCurrency(d.bookValueAtDisposal)} NBV`,
        amount:      d.disposalType === 'Sale'
          ? (Number(d.saleProceeds) || null)
          : (Number(d.bookValueAtDisposal) || null),
        date:        d.disposalDate ?? null,
        path:        `/asset-disposal/edit/${d.id}`,
        modal:       false,
      }));

    /* 3 — Asset Maintenance */
    assetMaintenanceStore.getAll()
      .filter(m => m.GLApprovalStatus === 'PendingApproval')
      .forEach(m => list.push({
        key:         `am-${m.id}`,
        moduleCode:  'FA',
        moduleLabel: 'Fixed Asset',
        typeName:    'Asset Maintenance',
        reference:   m.maintenanceCode ?? `AM-${m.id}`,
        description: m.maintenanceDescription ?? m.description ?? 'Asset maintenance',
        amount:      Number(m.totalMaintenanceCost) || null,
        date:        m.maintenanceDate ?? m.date ?? null,
        path:        `/asset-maintenance/edit/${m.id}`,
        modal:       false,
      }));

    /* 4 — Fleet Maintenance Records (modal-based — link to listing) */
    maintenanceRecordStore.getAll()
      .filter(r => r.GLApprovalStatus === 'PendingApproval')
      .forEach(r => list.push({
        key:         `mr-${r.id}`,
        moduleCode:  'FLEET',
        moduleLabel: 'Fleet',
        typeName:    'Fleet Maintenance',
        reference:   `MR-${r.id}`,
        description: r.description ?? r.serviceType ?? 'Maintenance record',
        amount:      Number(r.costOfService) || null,
        date:        r.date ?? null,
        path:        '/maintenance-records',
        modal:       true,
      }));

    /* 5 — Vehicle Service (modal-based — link to listing) */
    vehicleServiceStore.getAll()
      .filter(s => s.GLApprovalStatus === 'PendingApproval')
      .forEach(s => list.push({
        key:         `vs-${s.id}`,
        moduleCode:  'FLEET',
        moduleLabel: 'Fleet',
        typeName:    'Vehicle Service',
        reference:   `VS-${s.id}`,
        description: s.serviceType ?? 'Vehicle service',
        amount:      Number(s.costAmount) || null,
        date:        s.serviceDate ?? null,
        path:        '/vehicle-service',
        modal:       true,
      }));

    /* 6 — Depreciation Batches (group by BatchReference) */
    const depPending = depreciationHistoryStore.getAll()
      .filter(h => h.GLApprovalStatus === 'PendingApproval');
    const batchMap = {};
    depPending.forEach(h => {
      const bkey = h.BatchReference ?? `nobatch-${h.id}`;
      if (!batchMap[bkey]) batchMap[bkey] = { ref: bkey, count: 0, total: 0, date: h.date };
      batchMap[bkey].count++;
      batchMap[bkey].total += h.value || 0;
    });
    Object.values(batchMap).forEach(b => list.push({
      key:         `dep-${b.ref}`,
      moduleCode:  'FA',
      moduleLabel: 'Fixed Asset',
      typeName:    'Depreciation Batch',
      reference:   b.ref,
      description: `${b.count} schedule${b.count !== 1 ? 's' : ''} pending`,
      amount:      b.total,
      date:        b.date,
      path:        '/depreciation/post',
      modal:       false,
    }));

    return list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, []);

  const filtered = useMemo(() =>
    filterModule ? items.filter(i => i.moduleCode === filterModule) : items,
  [items, filterModule]);

  const totalFA    = items.filter(i => i.moduleCode === 'FA').length;
  const totalFleet = items.filter(i => i.moduleCode === 'FLEET').length;

  return (
    <div className="fade-up">

      {/* Stats */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <div className="summary-card">
          <div className="summary-card-icon blue"><Icon name="check" /></div>
          <div className="summary-card-value">{items.length}</div>
          <div className="summary-card-label">Pending GL Approval</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon teal"><Icon name="building" /></div>
          <div className="summary-card-value">{totalFA}</div>
          <div className="summary-card-label">Fixed Asset Items</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon green"><Icon name="car" /></div>
          <div className="summary-card-value">{totalFleet}</div>
          <div className="summary-card-label">Fleet Items</div>
        </div>
      </div>

      <div className="card">
        {/* Header */}
        <div className="card-header" style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div className="card-header-title">GL Approval Queue</div>
            <div className="card-header-sub">
              Items pending Finance approval across all modules — {filtered.length} of {items.length} shown
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              id={`${ID}-select-module`}
              className="form-control"
              style={{ minWidth: 150 }}
              value={filterModule}
              onChange={e => setFilterModule(e.target.value)}
            >
              <option value="">All Modules</option>
              <option value="FA">Fixed Asset</option>
              <option value="FLEET">Fleet</option>
            </select>
            {filterModule && (
              <button
                id={`${ID}-btn-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => setFilterModule('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--radius-lg)',
              background: '#f0fdf4', color: 'var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <Icon name="check" style={{ width: 26, height: 26 }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              {items.length === 0 ? 'Queue is clear' : 'No items match the filter'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {items.length === 0
                ? 'No records are currently pending GL approval.'
                : 'Try removing the module filter to see all pending items.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Module', 'Type', 'Reference', 'Description', 'Amount', 'Date', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11,
                      color: 'var(--text-secondary)', background: 'var(--bg-subtle)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.key} style={{ borderBottom: '1px solid var(--bg-subtle, #f8fafc)' }}>

                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${MODULE_BADGE[item.moduleCode] ?? 'badge-neutral'}`}>
                        {item.moduleLabel}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {item.typeName}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>
                        {item.reference}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                      <span style={{
                        display: 'block', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: 'var(--text-primary)',
                      }}>
                        {item.description}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {item.amount != null
                        ? <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtCurrency(item.amount)}
                          </span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>

                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtDate(item.date)}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          id={`${ID}-btn-review-${item.key}`}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 11, padding: '3px 12px', height: 26, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => navigate(item.path)}
                        >
                          Review
                          <Icon name="chevron" style={{ width: 11, height: 11 }} />
                        </button>
                        {item.modal && (
                          <span style={{
                            fontSize: 10, color: 'var(--text-muted)',
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                          }} title="Open the listing and find this record to approve">
                            <Icon name="alert" style={{ width: 11, height: 11, flexShrink: 0 }} />
                            Find in list
                          </span>
                        )}
                      </div>
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
