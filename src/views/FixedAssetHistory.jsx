import { useState, useMemo } from 'react';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { fixedAssetHistoryStore } from '../data/fixedAssetHistoryStore';
import { MOCK, nameOf } from '../data/mockData';
import { Icon } from '../components/Icon';

const ID = 'fahv';

const CHANGE_BADGE = {
  'Initial Registration': 'badge-success',
  'Revaluation':          'badge-info',
  'Maintenance Impact':   'badge-warning',
  'Disposal':             'badge-danger',
};

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export default function FixedAssetHistoryView() {
  const [assets]           = useState(() => fixedAssetStore.getAll());
  const [selectedAssetID, setSelectedAssetID] = useState('');

  const history = useMemo(() =>
    selectedAssetID
      ? fixedAssetHistoryStore.getByAssetId(Number(selectedAssetID))
      : fixedAssetHistoryStore.getAll().sort((a, b) => (b.changeDate ?? '').localeCompare(a.changeDate ?? '')),
    [selectedAssetID]
  );

  const selectedAsset = selectedAssetID ? fixedAssetStore.getById(selectedAssetID) : null;

  return (
    <div className="fade-up">
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">Asset History</h1>
          <p className="page-subtitle">Immutable audit trail — snapshots of asset changes over time</p>
        </div>
      </div>

      {/* ── Asset Selector ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: 300, flex: 1, marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Select Asset</label>
              <select
                id={`${ID}-select-asset`}
                className="form-control"
                value={selectedAssetID}
                onChange={e => setSelectedAssetID(e.target.value)}
              >
                <option value="">— All Assets (recent first) —</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div style={{
                padding: '10px 16px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', gap: 14, flex: 2,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="box" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)' }}>{selectedAsset.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {selectedAsset.code} · {nameOf.fixedAssetType(selectedAsset.fixedAssetTypeID)} · {nameOf.estate(selectedAsset.estateID)}
                    {' · Cost: '}{fmtCurrency(selectedAsset.totalCostOfAsset)}
                  </p>
                </div>
                <span className="badge badge-success" style={{ marginLeft: 'auto' }}>{selectedAsset.status}</span>
              </div>
            )}

            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {history.length} snapshot{history.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── History Timeline ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-title">Change History</div>
            <div className="card-header-sub">Newest first — each row is an immutable snapshot</div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="card-body">
            <div className="empty-state">
              <Icon name="history" />
              <p>{selectedAssetID ? 'No history snapshots for this asset.' : 'Select an asset to view its history.'}</p>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" id={`${ID}-table`}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Change Type</th>
                  <th>Asset</th>
                  <th>Present Value</th>
                  <th>Cost</th>
                  <th>Dep. Value</th>
                  <th>Useful Life</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} id={`${ID}-row-${h.id}`}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {fmtDate(h.changeDate)}
                    </td>
                    <td>
                      <span className={`badge ${CHANGE_BADGE[h.changeType] ?? 'badge-neutral'}`}>
                        {h.changeType}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--primary-dark)' }}>{h.fixedAssetCode}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.fixedAssetName}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                      {h.presentValue ? fmtCurrency(h.presentValue) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {fmtCurrency(h.totalCostOfAsset)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {fmtCurrency(h.depreciationValue)}
                      {h.newResidualValue != null && (
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--info)' }}>
                          New residual: {fmtCurrency(h.newResidualValue)}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {h.usefulLifeYears} yrs
                      {h.newUsefulLifeYears != null && (
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--info)', fontWeight: 600 }}>
                          → {h.newUsefulLifeYears} yrs
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 180 }}>
                      {h.warrantyClaimDate && (
                        <span style={{ display: 'block' }}>Warranty claim: {fmtDate(h.warrantyClaimDate)}</span>
                      )}
                      {h.newDepreciationRegisterNo && (
                        <span style={{ display: 'block' }}>Dep. Reg: {h.newDepreciationRegisterNo}</span>
                      )}
                      {h.assetMaintenanceID && (
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>Maint. #{h.assetMaintenanceID}</span>
                      )}
                      {!h.warrantyClaimDate && !h.newDepreciationRegisterNo && !h.assetMaintenanceID && (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                      )}
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
