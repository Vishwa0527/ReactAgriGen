/**
 * GLStatusBadge — renders a coloured badge for any GL approval status.
 *
 * Props:
 *   status      — 'Draft' | 'PendingApproval' | 'Approved' | 'Rejected'
 *   isPostedToGL — boolean — when true AND status==='Approved', shows 'Posted to GL'
 */

const STATUS_CONFIG = {
  Draft:           { label: 'GL Draft',         cls: 'badge-neutral' },
  PendingApproval: { label: 'Pending Approval',  cls: 'badge-warning' },
  Approved:        { label: 'GL Approved',        cls: 'badge-primary' },
  Posted:          { label: 'Posted to GL',       cls: 'badge-success' },
  Rejected:        { label: 'GL Rejected',        cls: 'badge-danger'  },
};

export function GLStatusBadge({ status, isPostedToGL = false }) {
  const key = isPostedToGL && status === 'Approved' ? 'Posted' : (status ?? 'Draft');
  const { label, cls } = STATUS_CONFIG[key] ?? STATUS_CONFIG.Draft;
  return <span className={`badge ${cls}`}>{label}</span>;
}
