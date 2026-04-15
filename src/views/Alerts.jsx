import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { alertsEngine } from '../data/alertsEngine';
import { Icon } from '../components/Icon';

const ID = 'al';

const SEV_BADGE = {
  danger:  'badge-danger',
  warning: 'badge-warning',
  info:    'badge-info',
};

const SEV_LABEL = {
  danger:  'Critical',
  warning: 'Warning',
  info:    'Info',
};

const SEV_BORDER = {
  danger:  '#fecaca',
  warning: '#fde68a',
  info:    '#bfdbfe',
};

const SEV_BG = {
  danger:  '#fff5f5',
  warning: '#fffbeb',
  info:    '#eff6ff',
};

const SEV_ICON_COLOR = {
  danger:  '#ef4444',
  warning: '#d97706',
  info:    '#3b82f6',
};

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

function DaysLabel({ days }) {
  if (days === null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  if (days < 0) return (
    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--danger)' }}>
      {Math.abs(days)}d overdue
    </span>
  );
  if (days === 0) return (
    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--danger)' }}>Today</span>
  );
  return (
    <span style={{
      fontWeight: 600, fontSize: 12,
      color: days <= 7 ? 'var(--danger)' : days <= 30 ? '#d97706' : 'var(--text-secondary)',
    }}>
      in {days}d
    </span>
  );
}

export default function Alerts() {
  const navigate = useNavigate();
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const all = useMemo(() => alertsEngine.compute(), []);

  const categories = useMemo(() => [...new Set(all.map(a => a.category))], [all]);

  const filtered = useMemo(() => {
    let rows = all;
    if (filterCategory) rows = rows.filter(r => r.category === filterCategory);
    if (filterSeverity) rows = rows.filter(r => r.severity === filterSeverity);
    return rows;
  }, [all, filterCategory, filterSeverity]);

  const dangerCount  = all.filter(a => a.severity === 'danger').length;
  const warningCount = all.filter(a => a.severity === 'warning').length;

  return (
    <div className="fade-up">

      {/* ── Summary cards ── */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <div className="summary-card">
          <div className="summary-card-icon teal"><Icon name="bell" /></div>
          <div className="summary-card-value">{all.length}</div>
          <div className="summary-card-label">Total Alerts</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
            <Icon name="settings" />
          </div>
          <div
            className="summary-card-value"
            style={{ color: dangerCount > 0 ? '#ef4444' : undefined }}
          >{dangerCount}</div>
          <div className="summary-card-label">Critical</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Icon name="clipboard" />
          </div>
          <div
            className="summary-card-value"
            style={{ color: warningCount > 0 ? '#d97706' : undefined }}
          >{warningCount}</div>
          <div className="summary-card-label">Warnings</div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-title">Alerts &amp; Notifications</div>
            <div className="card-header-sub">
              Time-sensitive items requiring attention — documents, licences, services, warranties
            </div>
          </div>
        </div>

        <div className="card-body" style={{ padding: '12px 20px' }}>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <select
                id={`${ID}-select-category`}
                className="form-control"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
              <select
                id={`${ID}-select-severity`}
                className="form-control"
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
              >
                <option value="">All Severity</option>
                <option value="danger">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            {(filterCategory || filterSeverity) && (
              <button
                id={`${ID}-btn-filter-clear`}
                className="btn btn-secondary btn-sm"
                onClick={() => { setFilterCategory(''); setFilterSeverity(''); }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {all.length}
            </span>
          </div>

          {/* Alert list */}
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 0',
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              {all.length === 0
                ? 'No active alerts — everything looks good.'
                : 'No alerts match the current filter.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(alert => (
                <div
                  key={alert.id}
                  id={`${ID}-alert-${alert.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${SEV_BORDER[alert.severity] || 'var(--border)'}`,
                    background: SEV_BG[alert.severity] || 'var(--surface)',
                  }}
                >
                  {/* Severity icon */}
                  <div style={{
                    width: 36, height: 36, flexShrink: 0,
                    borderRadius: 'var(--radius-md)',
                    background: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: SEV_ICON_COLOR[alert.severity],
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <Icon name={alert.icon} style={{ width: 16, height: 16 }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        className={`badge ${SEV_BADGE[alert.severity] ?? 'badge-neutral'}`}
                        style={{ fontSize: 10 }}
                      >
                        {SEV_LABEL[alert.severity] ?? alert.severity}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                        {alert.category}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {alert.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                      {alert.subtitle}
                    </div>
                  </div>

                  {/* Date + days remaining */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {fmtDate(alert.date)}
                    </div>
                    <DaysLabel days={alert.daysUntil} />
                  </div>

                  {/* Action */}
                  <button
                    id={`${ID}-btn-goto-${alert.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0 }}
                    onClick={() => navigate(alert.path)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
