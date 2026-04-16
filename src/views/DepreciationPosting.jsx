import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { depreciationStore } from '../data/depreciationStore';
import { depreciationHistoryStore } from '../data/depreciationHistoryStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { ListingPage } from '../components/ListingPage';
import { Icon } from '../components/Icon';

const ID = 'dp';

function fmtCurrency(v) {
  if (v === null || v === undefined) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

/** Last calendar day of a YYYY-MM period */
function periodEndDate(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

/** Format YYYY-MM as "April 2026" */
function fmtPeriod(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-LK', { month: 'long', year: 'numeric' });
}

export default function DepreciationPosting() {
  const navigate = useNavigate();

  const today = new Date();
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [schedules] = useState(() => depreciationStore.getAll());
  const [assets]    = useState(() => fixedAssetStore.getAll());
  const [yearMonth, setYearMonth]   = useState(defaultPeriod);
  const [ledgerRef, setLedgerRef]   = useState('');
  const [selected, setSelected]     = useState(new Set());
  const [postSuccess, setPostSuccess] = useState(null); // number of entries posted

  /* Enrich each schedule with monthly amount + already-posted flag for the chosen period */
  const enriched = useMemo(() => {
    const history = depreciationHistoryStore.getAll();
    return schedules
      .filter(s => s.status === 'Active')
      .map(s => {
        const asset          = assets.find(a => a.id === s.fixedAssetID);
        const monthlyAmount  = (s.depreciationValue || 0) / 12;
        const alreadyPosted  = history.some(h =>
          h.depreciationID === s.id &&
          (h.date || '').startsWith(yearMonth)
        );
        const totalPosted    = depreciationHistoryStore.totalPostedForSchedule(s.id);
        const bookValue      = Math.max(s.residualValue || 0, (s.assetValue || 0) - totalPosted);
        const fullyDep       = bookValue <= (s.residualValue || 0);
        return { ...s, _asset: asset, _monthlyAmount: monthlyAmount, _alreadyPosted: alreadyPosted, _bookValue: bookValue, _fullyDep: fullyDep };
      });
  }, [schedules, assets, yearMonth]);

  /* Auto-select all eligible rows whenever period changes */
  useEffect(() => {
    const eligible = new Set(
      enriched.filter(s => !s._alreadyPosted && !s._fullyDep).map(s => s.id)
    );
    setSelected(eligible);
    setPostSuccess(null);
  }, [yearMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const eligibleCount  = enriched.filter(s => !s._alreadyPosted && !s._fullyDep).length;
  const selectedCount  = enriched.filter(s => selected.has(s.id) && !s._alreadyPosted && !s._fullyDep).length;
  const totalToPost    = enriched
    .filter(s => selected.has(s.id) && !s._alreadyPosted && !s._fullyDep)
    .reduce((sum, s) => sum + s._monthlyAmount, 0);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll  = () => setSelected(new Set(enriched.filter(s => !s._alreadyPosted && !s._fullyDep).map(s => s.id)));
  const clearAll   = () => setSelected(new Set());

  const doPost = () => {
    const toPost = enriched.filter(s => selected.has(s.id) && !s._alreadyPosted && !s._fullyDep);
    if (toPost.length === 0) return;
    const endDate = periodEndDate(yearMonth);
    toPost.forEach(s => {
      depreciationHistoryStore.post(
        s.id, s.fixedAssetID, endDate, s._monthlyAmount,
        ledgerRef.trim() || null, s.groupID, s.estateID
      );
    });
    setPostSuccess(toPost.length);
    setSelected(new Set());
    setLedgerRef('');
  };

  if (postSuccess !== null) {
    return (
      <div className="fade-up" style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--radius-lg)',
          background: '#dcfce7', color: 'var(--success)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Icon name="check" style={{ width: 30, height: 30 }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Depreciation Posted
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
          <strong>{postSuccess}</strong> schedule{postSuccess !== 1 ? 's' : ''} posted for{' '}
          <strong>{fmtPeriod(yearMonth)}</strong>.
          Entries are now visible in Depreciation History.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            id={`${ID}-btn-postAnother`}
            className="btn btn-secondary"
            onClick={() => setPostSuccess(null)}
          >
            Post Another Period
          </button>
          <button
            id={`${ID}-btn-viewHistory`}
            className="btn btn-primary"
            onClick={() => navigate('/depreciation-history')}
          >
            View Depreciation History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      {/* Page title bar */}
      <div className="page-title-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            id={`${ID}-btn-back`}
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/depreciation')}
            style={{ gap: 4 }}
          >
            <Icon name="chevron" style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} /> Back
          </button>
          <div>
            <h1 className="page-title">Post Depreciation</h1>
            <p className="page-subtitle">Batch month-end depreciation posting — select a period and post all active schedules</p>
          </div>
        </div>
      </div>

      {/* Period & Reference card */}
      <div className="card" style={{ maxWidth: 680, marginBottom: 20 }}>
        <div className="card-body">
          <p className="section-label">Posting Period</p>
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Period <span className="required">*</span></label>
              <input
                id={`${ID}-input-period`}
                className="form-control"
                type="month"
                value={yearMonth}
                onChange={e => setYearMonth(e.target.value)}
              />
              <span className="field-hint">
                Posts as of {yearMonth ? periodEndDate(yearMonth) : '—'} · monthly = annual ÷ 12
              </span>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ledger Transaction Ref</label>
              <input
                id={`${ID}-input-ledgerRef`}
                className="form-control"
                value={ledgerRef}
                onChange={e => setLedgerRef(e.target.value)}
                placeholder="e.g. JNL-2026-04 (optional)"
              />
              <span className="field-hint">Applied to all entries in this batch</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', marginBottom: 16, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Eligible</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{eligibleCount}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Selected</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{selectedCount}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Total to Post</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--warning)' }}>{fmtCurrency(totalToPost)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            id={`${ID}-btn-selectAll`}
            className="btn btn-secondary btn-sm"
            onClick={selectAll}
            disabled={eligibleCount === 0}
          >Select All</button>
          <button
            id={`${ID}-btn-clearAll`}
            className="btn btn-secondary btn-sm"
            onClick={clearAll}
          >Clear</button>
          <button
            id={`${ID}-btn-post`}
            className="btn btn-success"
            disabled={selectedCount === 0}
            onClick={doPost}
          >
            <Icon name="check" style={{ width: 14, height: 14 }} />
            Post {selectedCount > 0 ? `${selectedCount} Schedule${selectedCount !== 1 ? 's' : ''}` : 'Selected'}
          </button>
        </div>
      </div>

      {/* Schedule table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 40 }}>
                  <input
                    id={`${ID}-chk-all`}
                    type="checkbox"
                    checked={selectedCount === eligibleCount && eligibleCount > 0}
                    onChange={e => e.target.checked ? selectAll() : clearAll()}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                {['Asset', 'Annual Dep.', 'Monthly Amt', 'Book Value', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--text-secondary)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No active depreciation schedules found.
                  </td>
                </tr>
              )}
              {enriched.map((s, i) => {
                const isEligible = !s._alreadyPosted && !s._fullyDep;
                const isChecked  = selected.has(s.id) && isEligible;
                return (
                  <tr
                    key={s.id}
                    style={{
                      background: isChecked ? 'rgba(37,99,235,0.04)' : i % 2 === 0 ? 'transparent' : 'var(--bg-page)',
                      opacity: isEligible ? 1 : 0.5,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        id={`${ID}-chk-${s.id}`}
                        type="checkbox"
                        checked={isChecked}
                        disabled={!isEligible}
                        onChange={() => isEligible && toggle(s.id)}
                        style={{ cursor: isEligible ? 'pointer' : 'not-allowed' }}
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {s._asset ? (
                        <div>
                          <span style={{
                            display: 'inline-flex', padding: '0 6px', height: 20,
                            background: 'var(--primary-light)', color: 'var(--primary-dark)',
                            borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 10,
                            alignItems: 'center', marginRight: 6,
                          }}>{s._asset.code}</span>
                          <span style={{ fontSize: 12 }}>{s._asset.name}</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--warning)' }}>
                      {fmtCurrency(s.depreciationValue)}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                      {fmtCurrency(s._monthlyAmount)}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12 }}>
                      {fmtCurrency(s._bookValue)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {s._fullyDep ? (
                        <span className="badge badge-danger" style={{ fontSize: 10 }}>Fully Depreciated</span>
                      ) : s._alreadyPosted ? (
                        <span className="badge badge-success" style={{ fontSize: 10 }}>Posted</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: 10 }}>Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
