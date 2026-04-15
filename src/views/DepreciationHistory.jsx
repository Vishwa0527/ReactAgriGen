import { useState, useMemo } from 'react';
import { depreciationStore } from '../data/depreciationStore';
import { depreciationHistoryStore } from '../data/depreciationHistoryStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { MOCK, nameOf } from '../data/mockData';
import { FormModal } from '../components/FormModal';
import { Icon } from '../components/Icon';

const ID = 'deph';

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const EMPTY_POST = { date: '', value: '', ledgerTransactionRef: '' };

export default function DepreciationHistoryView() {
  const [assets]      = useState(() => fixedAssetStore.getAll());
  const [schedules]   = useState(() => depreciationStore.getAll());
  const [selectedAssetID, setSelectedAssetID] = useState('');
  const [postings, setPostings] = useState(() => depreciationHistoryStore.getAll());
  const [postModal, setPostModal] = useState(null);
  const [postForm, setPostForm]  = useState(EMPTY_POST);
  const [postErrors, setPostErrors] = useState({});

  /* Derived data */
  const selectedAsset    = selectedAssetID ? fixedAssetStore.getById(selectedAssetID) : null;
  const selectedSchedule = selectedAssetID
    ? schedules.find(s => s.fixedAssetID === Number(selectedAssetID))
    : null;

  const history = useMemo(() => {
    let rows = selectedAssetID
      ? depreciationHistoryStore.getByAssetId(Number(selectedAssetID))
      : [...postings].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    // Add cumulative values
    let cumulative = 0;
    return rows.map(h => {
      cumulative += h.value || 0;
      const schedule = schedules.find(s => s.id === h.depreciationID);
      const bookValue = schedule ? Math.max(schedule.residualValue || 0, (schedule.assetValue || 0) - cumulative) : null;
      return { ...h, _cumulative: cumulative, _bookValue: bookValue, _schedule: schedule };
    });
  }, [selectedAssetID, postings, schedules]);

  /* Progress stats for selected asset */
  const totalPosted = selectedAssetID ? depreciationHistoryStore.totalPosted(Number(selectedAssetID)) : 0;
  const depreciableAmount = selectedSchedule ? (selectedSchedule.assetValue - (selectedSchedule.residualValue || 0)) : 0;
  const pctDepreciated = depreciableAmount > 0 ? Math.min(100, (totalPosted / depreciableAmount) * 100) : 0;
  const quarterlyAmount = selectedSchedule ? (selectedSchedule.depreciationValue / 4) : 0;

  /* Post depreciation modal */
  const openPost = () => {
    setPostForm({
      date: new Date().toISOString().slice(0, 10),
      value: quarterlyAmount ? quarterlyAmount.toFixed(2) : '',
      ledgerTransactionRef: '',
    });
    setPostErrors({});
    setPostModal(true);
  };

  const validatePost = () => {
    const e = {};
    if (!postForm.date) e.date = 'Date is required';
    const v = parseFloat(postForm.value);
    if (!v || v <= 0) e.value = 'Amount must be > 0';
    return e;
  };

  const submitPost = () => {
    const errs = validatePost();
    if (Object.keys(errs).length) { setPostErrors(errs); return; }
    depreciationHistoryStore.post(
      selectedSchedule.id,
      Number(selectedAssetID),
      postForm.date,
      parseFloat(postForm.value),
      postForm.ledgerTransactionRef.trim() || null,
      selectedSchedule.groupID,
      selectedSchedule.estateID
    );
    setPostings(depreciationHistoryStore.getAll());
    setPostModal(null);
  };

  return (
    <div className="fade-up">
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">Depreciation History</h1>
          <p className="page-subtitle">Period-by-period depreciation posting ledger</p>
        </div>
      </div>

      {/* Asset Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: 320, flex: 1, marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Select Asset</label>
              <select
                id={`${ID}-select-asset`}
                className="form-control"
                value={selectedAssetID}
                onChange={e => setSelectedAssetID(e.target.value)}
              >
                <option value="">— All Assets (recent first) —</option>
                {assets.map(a => {
                  const hasSchedule = schedules.some(s => s.fixedAssetID === a.id);
                  return (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}{hasSchedule ? '' : ' (no schedule)'}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedSchedule && (
              <button id={`${ID}-btn-post`} className="btn btn-primary" onClick={openPost}>
                <Icon name="plus" style={{ width: 14, height: 14 }} />
                Post Depreciation
              </button>
            )}

            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {history.length} posting{history.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Card (only for selected asset with schedule) */}
      {selectedSchedule && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Asset Value</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtCurrency(selectedSchedule.assetValue)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Posted</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{fmtCurrency(totalPosted)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Book Value</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{fmtCurrency(Math.max(selectedSchedule.residualValue || 0, selectedSchedule.assetValue - totalPosted))}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Residual</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)' }}>{fmtCurrency(selectedSchedule.residualValue)}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Depreciation Progress</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: pctDepreciated >= 100 ? 'var(--danger)' : 'var(--primary)' }}>
                  {pctDepreciated.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, pctDepreciated)}%`, height: '100%',
                  background: pctDepreciated >= 100 ? 'var(--danger)' : pctDepreciated >= 75 ? 'var(--warning)' : 'linear-gradient(90deg, var(--primary), var(--primary-mid))',
                  borderRadius: 5, transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtCurrency(0)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Depreciable: {fmtCurrency(depreciableAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-title">Posting Ledger</div>
            <div className="card-header-sub">All depreciation entries — {selectedAssetID ? 'chronological order' : 'latest first'}</div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="card-body">
            <div className="empty-state">
              <Icon name="chart" />
              <p>{selectedAssetID
                ? (selectedSchedule ? 'No depreciation posted yet. Click "Post Depreciation" to begin.' : 'This asset does not have a depreciation schedule.')
                : 'Select an asset or view all postings.'}</p>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" id={`${ID}-table`}>
              <thead>
                <tr>
                  <th>Date</th>
                  {!selectedAssetID && <th>Asset</th>}
                  <th>Period Amount</th>
                  <th>Cumulative</th>
                  <th>Book Value</th>
                  <th>Ledger Reference</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} id={`${ID}-row-${h.id}`}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(h.date)}</td>
                    {!selectedAssetID && (
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--primary-dark)' }}>
                          {nameOf.fixedAssetCode(h.fixedAssetID)}
                        </span>
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)' }}>
                          {nameOf.fixedAssetName(h.fixedAssetID)}
                        </span>
                      </td>
                    )}
                    <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--warning)' }}>
                      {fmtCurrency(h.value)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {fmtCurrency(h._cumulative)}
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>
                      {h._bookValue != null ? fmtCurrency(h._bookValue) : '—'}
                    </td>
                    <td>
                      {h.ledgerTransactionRef ? (
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>{h.ledgerTransactionRef}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Post Depreciation Modal */}
      {postModal && (
        <FormModal
          idPrefix={ID}
          title="Post Depreciation"
          subtitle={`${selectedAsset?.code} — ${selectedAsset?.name}`}
          onClose={() => setPostModal(null)}
          onSave={submitPost}
          saveLabel="Post Entry"
        >
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Period End Date <span className="required">*</span></label>
              <input
                id={`${ID}-input-postDate`}
                className={`form-control${postErrors.date ? ' input-error' : ''}`}
                type="date" value={postForm.date}
                onChange={e => { setPostForm(f => ({ ...f, date: e.target.value })); setPostErrors(e2 => ({ ...e2, date: undefined })); }}
              />
              {postErrors.date && <span className="field-error">{postErrors.date}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Amount (Rs.) <span className="required">*</span></label>
              <input
                id={`${ID}-input-postValue`}
                className={`form-control${postErrors.value ? ' input-error' : ''}`}
                type="number" min="0" step="0.01" value={postForm.value}
                onChange={e => { setPostForm(f => ({ ...f, value: e.target.value })); setPostErrors(e2 => ({ ...e2, value: undefined })); }}
                placeholder={quarterlyAmount > 0 ? `Quarterly: ${quarterlyAmount.toFixed(0)}` : '0.00'}
              />
              {postErrors.value && <span className="field-error">{postErrors.value}</span>}
              <span className="field-hint">Suggested quarterly: Rs. {quarterlyAmount.toLocaleString('en-LK', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Ledger Transaction Reference</label>
              <input
                id={`${ID}-input-postLedgerRef`}
                className="form-control" value={postForm.ledgerTransactionRef}
                onChange={e => setPostForm(f => ({ ...f, ledgerTransactionRef: e.target.value }))}
                placeholder="e.g. LT-DEP-Q3-2024-001"
              />
            </div>
          </div>

          {/* Preview */}
          <div style={{
            marginTop: 14, padding: '10px 14px', background: 'var(--primary-light)',
            borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--primary-dark)',
          }}>
            <strong>After posting:</strong> Cumulative = {fmtCurrency(totalPosted + (parseFloat(postForm.value) || 0))}
            {' · '}Book Value = {fmtCurrency(Math.max(selectedSchedule?.residualValue || 0, (selectedSchedule?.assetValue || 0) - totalPosted - (parseFloat(postForm.value) || 0)))}
          </div>
        </FormModal>
      )}
    </div>
  );
}
