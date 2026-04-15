import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

const REPORTS = [
  {
    path:     '/reports/fleet-register',
    title:    'Fleet Register',
    desc:     'Complete vehicle register with type, estate, status and cost details.',
    icon:     'car',
    module:   'Fleet Management',
    color:    'teal',
  },
  {
    path:     '/reports/vehicle-documents',
    title:    'Vehicle Document Status',
    desc:     'Vehicle documents with expiry dates and current status.',
    icon:     'file',
    module:   'Fleet Management',
    color:    'teal',
  },
  {
    path:     '/reports/driver-assignments',
    title:    'Driver Assignment History',
    desc:     'All driver-to-vehicle assignments with active/closed status.',
    icon:     'link',
    module:   'Fleet Management',
    color:    'teal',
  },
  {
    path:     '/reports/daily-running',
    title:    'Daily Running Log',
    desc:     'Trip-by-trip odometer records with mileage and duration.',
    icon:     'route',
    module:   'Fleet Management',
    color:    'teal',
  },
  {
    path:     '/reports/depreciation-schedule',
    title:    'Depreciation Schedule',
    desc:     'Active and closed depreciation schedules with annual rate and end dates.',
    icon:     'chart',
    module:   'Fixed Asset Management',
    color:    'blue',
  },
  {
    path:     '/reports/asset-nbv',
    title:    'Asset Net Book Value',
    desc:     'Current net book value per asset, computed from posted depreciation.',
    icon:     'dollar',
    module:   'Fixed Asset Management',
    color:    'blue',
  },
  {
    path:     '/reports/asset-maintenance',
    title:    'Asset Maintenance Summary',
    desc:     'All asset maintenance events with cost totals and status.',
    icon:     'wrench',
    module:   'Fixed Asset Management',
    color:    'blue',
  },
];

const MODULE_COLORS = {
  teal: { bg: 'var(--primary-light)', color: 'var(--primary)' },
  blue: { bg: '#dbeafe', color: '#1d4ed8' },
};

export default function ReportsHub() {
  const navigate = useNavigate();

  const fleet = REPORTS.filter(r => r.module === 'Fleet Management');
  const fa    = REPORTS.filter(r => r.module === 'Fixed Asset Management');

  function Section({ label, items }) {
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12,
        }}>
          {label}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {items.map(r => {
            const col = MODULE_COLORS[r.color] || MODULE_COLORS.teal;
            return (
              <button
                key={r.path}
                onClick={() => navigate(r.path)}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '16px 18px',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = col.color; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{
                  width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--radius-sm)',
                  background: col.bg, color: col.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={r.icon} style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {r.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-title">Reports</div>
            <div className="card-header-sub">
              Select a report to view, filter, print, or export as CSV
            </div>
          </div>
        </div>
        <div className="card-body" style={{ padding: '20px 24px' }}>
          <Section label="Fleet Management" items={fleet} />
          <Section label="Fixed Asset Management" items={fa} />
        </div>
      </div>
    </div>
  );
}
