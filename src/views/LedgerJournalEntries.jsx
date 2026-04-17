/**
 * Ledger Journal Entries — read-only audit ledger of all posted GL transactions.
 *
 * Transactions are grouped by documentReference (one journal entry per document).
 * Click any row to expand and see the individual Dr/Cr lines.
 *
 * IMMUTABILITY NOTE: GL lines are never deleted — use glEngine.reverse() for corrections.
 * Reversal entries are flagged with a REV badge.
 */

import { useState, useMemo, Fragment } from 'react';
import { ledgerTransactionStore } from '../data/ledgerTransactionStore';
import { ledgerAccountStore }     from '../data/ledgerAccountStore';
import { glMappingStore }         from '../data/glMappingStore';
import { Icon }                   from '../components/Icon';

const ID = 'lje';

const MODULE_BADGE = { FA: 'badge-info', FLEET: 'badge-success' };

const fmt = n =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default function LedgerJournalEntries() {
  const [search,       setSearch]       = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [expanded,     setExpanded]     = useState(new Set());

  /* Build a lookup map: transactionTypeCode → friendly name */
  const typeNameMap = useMemo(() => {
    const m = {};
    glMappingStore.getAllHeaders().forEach(h => { m[h.transactionTypeCode] = h.transactionTypeName; });
    return m;
  }, []);

  /* Build a lookup map: ledgerAccountID → account object */
  const accountMap = useMemo(() => {
    const m = {};
    ledgerAccountStore.getAll().forEach(a => { m[a.id] = a; });
    return m;
  }, []);

  /* Group all ledger lines by documentReference */
  const documents = useMemo(() => {
    const allLines = ledgerTransactionStore.getAll();
    if (allLines.length === 0) return [];

    const groups = {};
    allLines.forEach(line => {
      if (!groups[line.documentReference]) {
        groups[line.documentReference] = {
          documentReference:   line.documentReference,
          transactionDate:     line.transactionDate,
          moduleCode:          line.moduleCode,
          transactionTypeCode: line.transactionTypeCode,
          sourceTableName:     line.sourceTableName,
          sourceRecordID:      line.sourceRecordID,
          batchReference:      line.batchReference,
          lines:               [],
          drTotal:             0,
          crTotal:             0,
          hasReversal:         false,
        };
      }
      const g = groups[line.documentReference];
      g.lines.push(line);
      if (line.drCr === 'DR') g.drTotal += line.amount;
      else                     g.crTotal += line.amount;
      if (line.isReversed)     g.hasReversal = true;
    });

    return Object.values(groups)
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, []);

  /* Unique transaction types for the filter dropdown */
  const uniqueTypes = useMemo(
    () => [...new Set(documents.map(d => d.transactionTypeCode))],
    [documents],
  );

  /* Apply filters */
  const filtered = useMemo(() => {
    let rows = documents;
    if (filterModule) rows = rows.filter(r => r.moduleCode === filterModule);
    if (filterType)   rows = rows.filter(r => r.transactionTypeCode === filterType);
    if (dateFrom)     rows = rows.filter(r => r.transactionDate >= dateFrom);
    if (dateTo)       rows = rows.filter(r => r.transactionDate <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.documentReference?.toLowerCase().includes(q) ||
        r.batchReference?.toLowerCase().includes(q) ||
        r.sourceTableName?.toLowerCase().includes(q) ||
        String(r.sourceRecordID).includes(q)
      );
    }
    return rows;
  }, [documents, filterModule, filterType, dateFrom, dateTo, search]);

  const totalDR = filtered.reduce((s, d) => s + d.drTotal, 0);
  const totalCR = filtered.reduce((s, d) => s + d.crTotal, 0);

  const toggle = docRef => setExpanded(prev => {
    const next = new Set(prev);
    next.has(docRef) ? next.delete(docRef) : next.add(docRef);
    return next;
  });

  const clearFilters = () => {
    setSearch(''); setFilterModule(''); setFilterType('');
    setDateFrom(''); setDateTo('');
  };
  const isFiltered = !!(search || filterModule || filterType || dateFrom || dateTo);

  return (
    <div className="fade-up">

      {/* Stats */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <div className="summary-card">
          <div className="summary-card-icon blue"><Icon name="dollar" /></div>
          <div className="summary-card-value">{documents.length}</div>
          <div className="summary-card-label">Journal Entries</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon teal"><Icon name="dollar" /></div>
          <div className="summary-card-value" style={{ fontSize: 16 }}>
            Rs. {Number(totalDR).toLocaleString('en-LK', { maximumFractionDigits: 0 })}
          </div>
          <div className="summary-card-label">Total DR (filtered)</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon green"><Icon name="dollar" /></div>
          <div className="summary-card-value" style={{ fontSize: 16 }}>
            Rs. {Number(totalCR).toLocaleString('en-LK', { maximumFractionDigits: 0 })}
          </div>
          <div className="summary-card-label">Total CR (filtered)</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-title">GL Journal Entries</div>
            <div className="card-header-sub">All posted GL transactions — read-only audit ledger</div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <input
              id={`${ID}-input-search`}
              className="form-control"
              placeholder="Search doc ref, batch ref, source…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
            <select
              id={`${ID}-select-module`}
              className="form-control"
              value={filterModule}
              onChange={e => setFilterModule(e.target.value)}
            >
              <option value="">All Modules</option>
              <option value="FA">Fixed Asset</option>
              <option value="FLEET">Fleet</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 200, marginBottom: 0 }}>
            <select
              id={`${ID}-select-type`}
              className="form-control"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">All Transaction Types</option>
              {uniqueTypes.map(tc => (
                <option key={tc} value={tc}>{typeNameMap[tc] ?? tc}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              id={`${ID}-input-date-from`}
              className="form-control"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="From date"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              id={`${ID}-input-date-to`}
              className="form-control"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="To date"
            />
          </div>
          {isFiltered && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} of {documents.length}
          </span>
        </div>

        {/* Empty — no postings at all */}
        {documents.length === 0 ? (
          <div style={{ padding: '52px 20px', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--radius-lg)',
              background: 'var(--primary-light)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <Icon name="dollar" style={{ width: 26, height: 26 }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              No journal entries yet
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              GL transactions appear here after Finance approves records in any module.
            </p>
          </div>

        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No entries match the current filters.
          </div>

        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={TH({ width: 28 })}></th>
                  <th style={TH()}>Doc Ref</th>
                  <th style={TH()}>Date</th>
                  <th style={TH()}>Module</th>
                  <th style={TH()}>Transaction Type</th>
                  <th style={TH()}>Source</th>
                  <th style={TH({ textAlign: 'right' })}>DR Total</th>
                  <th style={TH({ textAlign: 'right' })}>CR Total</th>
                  <th style={TH({ width: 80 })}></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(doc => {
                  const isOpen   = expanded.has(doc.documentReference);
                  const balanced = Math.abs(doc.drTotal - doc.crTotal) < 0.01;

                  return (
                    <Fragment key={doc.documentReference}>
                      {/* ── Document row ── */}
                      <tr
                        style={{
                          borderBottom: isOpen ? 'none' : '1px solid var(--bg-subtle, #f8fafc)',
                          cursor: 'pointer',
                          background: isOpen ? 'var(--primary-light)' : undefined,
                        }}
                        onClick={() => toggle(doc.documentReference)}
                      >
                        <td style={TD({ width: 28 })}>
                          <Icon name="chevron" style={{
                            width: 13, height: 13,
                            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s',
                            color: 'var(--text-muted)',
                          }} />
                        </td>
                        <td style={TD()}>
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 700,
                            fontSize: 12, color: 'var(--primary)',
                          }}>
                            {doc.documentReference}
                          </span>
                          {doc.hasReversal && (
                            <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 6 }}>REV</span>
                          )}
                        </td>
                        <td style={TD({ whiteSpace: 'nowrap' })}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {fmtDate(doc.transactionDate)}
                          </span>
                        </td>
                        <td style={TD()}>
                          <span className={`badge ${MODULE_BADGE[doc.moduleCode] ?? 'badge-neutral'}`}>
                            {doc.moduleCode}
                          </span>
                        </td>
                        <td style={TD()}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {typeNameMap[doc.transactionTypeCode] ?? doc.transactionTypeCode}
                          </span>
                        </td>
                        <td style={TD()}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {doc.sourceTableName}#{doc.sourceRecordID}
                          </span>
                          {doc.batchReference && (
                            <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              Batch: {doc.batchReference}
                            </span>
                          )}
                        </td>
                        <td style={TD({ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' })}>
                          {fmt(doc.drTotal)}
                        </td>
                        <td style={TD({ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--success, #16a34a)', whiteSpace: 'nowrap' })}>
                          {fmt(doc.crTotal)}
                        </td>
                        <td style={TD({ width: 80 })}>
                          {balanced
                            ? <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Icon name="check" style={{ width: 11, height: 11 }} /> Balanced
                              </span>
                            : <span style={{ fontSize: 11, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Icon name="alert" style={{ width: 11, height: 11 }} /> Unbal.
                              </span>
                          }
                        </td>
                      </tr>

                      {/* ── Expanded line detail ── */}
                      {isOpen && doc.lines.map(line => {
                        const acct = accountMap[line.ledgerAccountID];
                        return (
                          <tr key={line.id} style={{
                            borderBottom: '1px solid var(--bg-subtle, #f8fafc)',
                            background: 'var(--bg-page)',
                          }}>
                            <td style={TD({ width: 28 })}></td>
                            <td colSpan={2} style={{ padding: '7px 14px 7px 28px', verticalAlign: 'middle' }}>
                              <span
                                className={`badge ${line.drCr === 'DR' ? 'badge-primary' : 'badge-success'}`}
                                style={{ fontSize: 10, marginRight: 8 }}
                              >
                                {line.drCr}
                              </span>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                                {acct?.accountCode ?? `#${line.ledgerAccountID}`}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                                {acct?.accountName ?? 'Unknown Account'}
                              </span>
                              {line.isReversed && (
                                <span className="badge badge-danger" style={{ fontSize: 9, marginLeft: 6 }}>REV</span>
                              )}
                            </td>
                            <td colSpan={4} style={{ padding: '7px 14px', verticalAlign: 'middle', fontSize: 11, color: 'var(--text-muted)' }}>
                              {line.lineDescription}
                            </td>
                            <td style={{
                              padding: '7px 14px', verticalAlign: 'middle',
                              textAlign: 'right', fontFamily: 'monospace', fontWeight: 600,
                              color: line.drCr === 'DR' ? 'var(--primary)' : 'var(--success, #16a34a)',
                              whiteSpace: 'nowrap',
                            }}>
                              {fmt(line.amount)}
                            </td>
                            <td></td>
                          </tr>
                        );
                      })}

                      {/* ── Separator row after expanded block ── */}
                      {isOpen && (
                        <tr style={{ height: 4, background: 'var(--border)' }}>
                          <td colSpan={9}></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>

              {/* Grand totals footer */}
              <tfoot>
                <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={6} style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Totals — {filtered.length} document{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                    {fmt(totalDR)}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--success, #16a34a)', whiteSpace: 'nowrap' }}>
                    {fmt(totalCR)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>

            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared cell style helpers ──────────────────────────────────────── */
function TH(overrides = {}) {
  return {
    padding: '9px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11,
    color: 'var(--text-secondary)', background: 'var(--bg-subtle)',
    whiteSpace: 'nowrap', ...overrides,
  };
}
function TD(overrides = {}) {
  return { padding: '10px 14px', verticalAlign: 'middle', ...overrides };
}
