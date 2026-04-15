import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetDisposalStore } from '../data/assetDisposalStore';
import { fixedAssetStore } from '../data/fixedAssetStore';
import { MOCK } from '../data/mockData';
import { ListingPage } from '../components/ListingPage';
import { Icon } from '../components/Icon';

const ID = 'ad';

const TYPE_BADGE = {
  'Sale':      'badge-success',
  'Write-Off': 'badge-danger',
  'Donation':  'badge-info',
  'Scrap':     'badge-warning',
};

const STATUS_BADGE = {
  'Draft':     'badge-neutral',
  'Approved':  'badge-info',
  'Completed': 'badge-success',
};

function fmtCurrency(v) {
  if (v === null || v === undefined || v === '') return '—';
  return `Rs. ${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default function AssetDisposal() {
  const navigate = useNavigate();
  const [data, setData]                   = useState(() => assetDisposalStore.getAll());
  const [assets]                          = useState(() => fixedAssetStore.getAll());
  const [search, setSearch]               = useState('');
  const [filterType, setFilterType]       = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const enriched = useMemo(() => data.map(d => ({
    ...d,
    _asset:  assets.find(a => a.id === d.fixedAssetID),
    _estate: MOCK.estates.find(e => e.id === d.estateID),
  })), [data, assets]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterType) rows = rows.filter(r => r.disposalType === filterType);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.disposalCode?.toLowerCase().includes(q) ||
        r._asset?.code?.toLowerCase().includes(q) ||
        r._asset?.name?.toLowerCase().includes(q) ||
        r.approvedBy?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [enriched, search, filterType]);

  /* Stats */
  const totalDisposals    = data.length;
  const totalSaleProceeds = assetDisposalStore.totalSaleProceeds();
  const totalGainLoss     = assetDisposalStore.totalGainLoss();

  const del = () => {
    assetDisposalStore.remove(confirmDelete.id);
    setData(assetDisposalStore.getAll());
    setConfirmDelete(null);
  };

  return (
    <>
      {/* Stats */}
      <div className="fade-up">
        <div className="summary-grid" style={{ marginBottom: 0 }}>
          <div className="summary-card">
            <div className="summary-card-icon teal"><Icon name="trash" /></div>
            <div className="summary-card-value">{totalDisposals}</div>
            <div className="summary-card-label">Total Disposals</div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon blue"><Icon name="dollar" /></div>
            <div className="summary-card-value">{fmtCurrency(totalSaleProceeds)}</div>
            <div className="summary-card-label">Total Sale Proceeds</div>
          </div>
          <div className="summary-card">
            <div className={`summary-card-icon ${totalGainLoss >= 0 ? 'green' : 'red'}`}>
              <Icon name="chart" />
            </div>
            <div className="summary-card-value" style={{ color: totalGainLoss >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {totalGainLoss >= 0 ? '+' : ''}{fmtCurrency(totalGainLoss)}
            </div>
            <div className="summary-card-label">Net Gain / Loss on Sales</div>
          </div>
        </div>
      </div>

      <ListingPage
        idPrefix={ID}
        title="Asset Disposal"
        subtitle="Disposal records — write-offs, sales, donations and scrapping of fixed assets"
        columns={[
          {
            key: 'disposalCode',
            label: 'Code',
            render: v => <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{v}</span>,
          },
          {
            key: '_asset',
            label: 'Fixed Asset',
            render: v => v ? (
              <div>
                <span style={{
                  display: 'inline-flex', padding: '0 6px', height: 22,
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 10,
                  alignItems: 'center', marginRight: 6,
                }}>{v.code}</span>
                <span style={{ fontSize: 12 }}>{v.name}</span>
              </div>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'disposalDate',
            label: 'Disposal Date',
            render: v => <span style={{ fontSize: 12 }}>{fmtDate(v)}</span>,
          },
          {
            key: 'disposalType',
            label: 'Type',
            render: v => <span className={`badge ${TYPE_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
          {
            key: 'bookValueAtDisposal',
            label: 'Book Value',
            render: v => <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(v)}</span>,
          },
          {
            key: 'saleProceeds',
            label: 'Sale Proceeds',
            render: (v, row) => row.disposalType === 'Sale'
              ? <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(v)}</span>
              : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>,
          },
          {
            key: 'gainLossOnDisposal',
            label: 'Gain / Loss',
            render: (v, row) => {
              if (row.disposalType !== 'Sale') return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;
              const val = Number(v || 0);
              return (
                <span style={{
                  fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums',
                  color: val >= 0 ? 'var(--success)' : 'var(--danger)',
                }}>
                  {val >= 0 ? '+' : ''}{fmtCurrency(val)}
                </span>
              );
            },
          },
          {
            key: 'status',
            label: 'Status',
            render: v => <span className={`badge ${STATUS_BADGE[v] ?? 'badge-neutral'}`}>{v}</span>,
          },
        ]}
        data={filtered}
        onAdd={() => navigate('/asset-disposal/add')}
        addLabel="Record Disposal"
        onEdit={row => navigate(`/asset-disposal/edit/${row.id}`)}
        onDelete={row => setConfirmDelete(row)}
        filterSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <input
                id={`${ID}-input-search`}
                className="form-control"
                placeholder="Search by code, asset, approved by…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
              <select
                id={`${ID}-select-type`}
                className="form-control"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Sale">Sale</option>
                <option value="Write-Off">Write-Off</option>
                <option value="Donation">Donation</option>
                <option value="Scrap">Scrap</option>
              </select>
            </div>
            {(search || filterType) && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); setFilterType(''); }}
              >Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {data.length}
            </span>
          </div>
        }
      />

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div className="card fade-up" style={{ width: '100%', maxWidth: 420 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: '#fee2e2', color: 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="trash" style={{ width: 17, height: 17 }} />
                </span>
                <div>
                  <div className="card-header-title">Delete Disposal Record</div>
                  <div className="card-header-sub">This action cannot be undone</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                Delete disposal record{' '}
                <strong>{confirmDelete.disposalCode}</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Asset: {assets.find(a => a.id === confirmDelete.fixedAssetID)?.name ?? '—'} &nbsp;·&nbsp;
                Type: {confirmDelete.disposalType} &nbsp;·&nbsp;
                {fmtDate(confirmDelete.disposalDate)}
              </p>
            </div>
            <div className="card-footer">
              <button id={`${ID}-btn-del-cancel`} className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button id={`${ID}-btn-del-confirm`} className="btn btn-danger" onClick={del}>
                <Icon name="trash" style={{ width: 14, height: 14 }} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
