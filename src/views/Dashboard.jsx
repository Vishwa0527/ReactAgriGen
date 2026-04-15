import { useState, useMemo } from 'react';
import { Icon }              from '../components/Icon';
import { MOCK, nameOf }      from '../data/mockData';
import { useNavigate }       from 'react-router-dom';
import { maintenanceTaskStore }  from '../data/maintenanceTaskStore';
import { vehicleServiceStore }   from '../data/vehicleServiceStore';
import { maintenanceRecordStore } from '../data/maintenanceRecordStore';
import { driverAssignmentStore } from '../data/driverAssignmentStore';
import { dailyRunningStore }     from '../data/dailyRunningStore';

const ID = 'db-act';

/* ── Activity event type visual config ── */
const ACTIVITY_STYLE = {
  'Maintenance Task':   { background: 'var(--primary-light)', color: 'var(--primary-dark)', border: '1px solid var(--primary)' },
  'Vehicle Service':    { background: '#dcfce7', color: '#166534',  border: '1px solid #86efac' },
  'Maintenance Record': { background: '#fef3c7', color: '#92400e',  border: '1px solid #fde68a' },
  'Driver Assignment':  { background: '#ede9fe', color: '#5b21b6',  border: '1px solid #a78bfa' },
  'Daily Running':      { background: '#ccfbf1', color: '#065f46',  border: '1px solid #5eead4' },
};

const ACTIVITY_TYPES = Object.keys(ACTIVITY_STYLE);

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function ActivityBadge({ type }) {
  const s = ACTIVITY_STYLE[type] ?? {};
  return (
    <span style={{
      ...s,
      padding: '2px 8px', fontSize: 11, fontWeight: 700,
      borderRadius: 'var(--radius-sm)', display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

function StatCard({ icon, iconClass, value, label, sub }) {
  return (
    <div className="summary-card">
      <div className={`summary-card-icon ${iconClass}`}><Icon name={icon} /></div>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-label">{label}</div>
      {sub && <div className="summary-card-trend">{sub}</div>}
    </div>
  );
}

function AlertRow({ icon, color, title, detail, badge, badgeClass }) {
  return (
    <tr>
      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={icon} style={{ color }} /><span style={{ fontWeight: 500 }}>{title}</span></div></td>
      <td style={{ color: 'var(--text-secondary)' }}>{detail}</td>
      <td><span className={`badge ${badgeClass}`}>{badge}</span></td>
    </tr>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [fromDate,   setFromDate]   = useState('');
  const [toDate,     setToDate]     = useState('');
  const [filterType, setFilterType] = useState('');

  const expiring       = MOCK.vehicleDocuments.filter(d => d.status === 'Expired' || d.status === 'Expiring Soon');
  const inService      = MOCK.vehicles.filter(v => v.status === 'Maintenance').length;
  const activeVehicles = MOCK.vehicles.filter(v => v.status === 'Active').length;
  const totalKm        = MOCK.dailyRunning.reduce((acc, r) => acc + (r.endOdo - r.startOdo), 0);
  const totalCost      = MOCK.vehicleService.reduce((acc, s) => acc + s.costAmount, 0);

  const recentMaintenance = MOCK.maintenanceTasks.slice(0, 5);

  /* ── Build combined activity event list ── */
  const allEvents = useMemo(() => {
    const tasks = maintenanceTaskStore.getAll().map(t => ({
      id:          `mt-${t.id}`,
      type:        'Maintenance Task',
      date:        t.date,
      refCode:     t.refCode,
      vehicleID:   t.vehicleID,
      description: `${t.mode} · ${t.taskType}`,
    }));

    const services = vehicleServiceStore.getAll().map(s => {
      const taskRef = maintenanceTaskStore.getById(s.maintenanceTaskID)?.refCode ?? '—';
      return {
        id:          `vs-${s.id}`,
        type:        'Vehicle Service',
        date:        s.serviceDate,
        refCode:     taskRef,
        vehicleID:   s.vehicleID,
        description: `Service at ${Number(s.odometer).toLocaleString()} km`,
      };
    });

    const records = maintenanceRecordStore.getAll().map(r => {
      const taskRef = maintenanceTaskStore.getById(r.maintenanceTaskID)?.refCode ?? '—';
      return {
        id:          `mr-${r.id}`,
        type:        'Maintenance Record',
        date:        r.date,
        refCode:     taskRef,
        vehicleID:   r.vehicleID,
        description: r.description,
      };
    });

    const assignments = driverAssignmentStore.getAll().map(a => ({
      id:          `da-${a.id}`,
      type:        'Driver Assignment',
      date:        a.startDate,
      refCode:     '',
      vehicleID:   a.vehicleID,
      description: `${nameOf.driver(a.driverID)} assigned${a.endDate ? ` (ended ${fmtDate(a.endDate)})` : ' (active)'}`,
    }));

    const runs = dailyRunningStore.getAll().map(r => ({
      id:          `dr-${r.id}`,
      type:        'Daily Running',
      date:        r.startDateTime?.substring(0, 10) ?? '',
      refCode:     r.refCode,
      vehicleID:   r.vehicleID,
      description: `${r.endOdo - r.startOdo} km · ${nameOf.driver(r.driverID)}`,
    }));

    return [...tasks, ...services, ...records, ...assignments, ...runs]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, []);

  /* ── Apply filters ── */
  const filtered = useMemo(() => allEvents.filter(e => {
    if (filterType && e.type !== filterType) return false;
    if (fromDate   && e.date < fromDate)     return false;
    if (toDate     && e.date > toDate)       return false;
    return true;
  }), [allEvents, filterType, fromDate, toDate]);

  const isFiltered = filterType || fromDate || toDate;

  const clearFilters = () => { setFromDate(''); setToDate(''); setFilterType(''); };

  return (
    <div className="fade-up">
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Fleet overview — Vehicle Workshop ERP</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button id={`${ID}-btn-export`} className="btn btn-secondary"><Icon name="download" />Export</button>
          <button id={`${ID}-btn-addVehicle`} className="btn btn-primary" onClick={() => navigate('/vehicles')}><Icon name="plus" />Add Vehicle</button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <StatCard icon="car"      iconClass="teal"   value={MOCK.vehicles.length}     label="Total Vehicles"    sub={`${activeVehicles} active`} />
        <StatCard icon="user"     iconClass="blue"   value={MOCK.drivers.length}      label="Registered Drivers" sub="4 with valid licence" />
        <StatCard icon="settings" iconClass="amber"  value={MOCK.maintenanceTasks.length} label="Maintenance Tasks" sub="This month" />
        <StatCard icon="building" iconClass="purple" value={MOCK.workshops.length}    label="Workshops"          sub="2 active" />
        <StatCard icon="route"    iconClass="teal"   value={`${totalKm.toLocaleString()} km`} label="Total KM (Oct)" />
        <StatCard icon="service"  iconClass="red"    value={`Rs. ${(totalCost/1000).toFixed(0)}K`} label="Service Cost (Oct)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Alerts */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-header-title">Document Alerts</div>
              <div className="card-header-sub">Expiring or expired vehicle documents</div>
            </div>
            <span className="badge badge-danger">{expiring.length} alerts</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Vehicle</th><th>Document</th><th>Status</th></tr></thead>
              <tbody>
                {expiring.map(doc => (
                  <AlertRow
                    key={doc.id}
                    icon={doc.status === 'Expired' ? 'alert' : 'bell'}
                    color={doc.status === 'Expired' ? 'var(--danger)' : 'var(--warning)'}
                    title={nameOf.vehicle(doc.vehicleID)}
                    detail={nameOf.docType(doc.documentTypeID)}
                    badge={doc.status}
                    badgeClass={doc.status === 'Expired' ? 'badge-danger' : 'badge-warning'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Maintenance */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-header-title">Recent Maintenance</div>
              <div className="card-header-sub">Latest maintenance tasks</div>
            </div>
            <button id={`${ID}-btn-viewMaintenance`} className="btn btn-secondary btn-sm" onClick={() => navigate('/maintenance')}>View All</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Vehicle</th><th>Mode</th><th>Cost</th></tr></thead>
              <tbody>
                {recentMaintenance.map(t => (
                  <tr key={t.id}>
                    <td><span style={{ fontWeight: 500, color: 'var(--primary)' }}>{t.refCode}</span></td>
                    <td>{nameOf.vehicle(t.vehicleID)}</td>
                    <td><span className={`badge ${t.mode === 'Breakdown' ? 'badge-danger' : t.mode === 'Preventive' ? 'badge-info' : 'badge-primary'}`}>{t.mode}</span></td>
                    <td>Rs. {t.costTotal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle Status */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title">Vehicle Status Summary</div>
          </div>
          <div className="card-body">
            {['Active', 'In Service', 'Maintenance'].map(status => {
              const count = MOCK.vehicles.filter(v => v.status === status).length;
              const pct = Math.round((count / MOCK.vehicles.length) * 100);
              const color = status === 'Active' ? 'var(--success)' : status === 'Maintenance' ? 'var(--danger)' : 'var(--warning)';
              return (
                <div key={status} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{status}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{count} vehicles ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Running Summary */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title">Recent Daily Running</div>
            <button id={`${ID}-btn-viewDailyRunning`} className="btn btn-secondary btn-sm" onClick={() => navigate('/daily-running')}>View All</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ref</th><th>Vehicle</th><th>Driver</th><th>KM</th></tr></thead>
              <tbody>
                {MOCK.dailyRunning.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{r.refCode}</td>
                    <td>{nameOf.vehicle(r.vehicleID)}</td>
                    <td>{nameOf.driver(r.driverID)}</td>
                    <td><strong>{r.endOdo - r.startOdo}</strong> km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Activity History ── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          <div>
            <div className="card-header-title">Activity History</div>
            <div className="card-header-sub">Maintenance, vehicle services, driver assignments and daily running — sorted newest first</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            {filtered.length} of {allEvents.length} events
          </span>
        </div>

        {/* Filter bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From</span>
            <input
              id={`${ID}-input-from`}
              type="date"
              className="form-control"
              style={{ width: 150 }}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To</span>
            <input
              id={`${ID}-input-to`}
              type="date"
              className="form-control"
              style={{ width: 150 }}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>

          <select
            id={`${ID}-select-type`}
            className="form-control"
            style={{ minWidth: 190 }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">— All Activity Types —</option>
            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {isFiltered && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>

        {/* Activity table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Ref</th>
                <th>Vehicle</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                    No activity matches the current filters.
                  </td>
                </tr>
              ) : filtered.map(e => (
                <tr key={e.id}>
                  <td><ActivityBadge type={e.type} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                  <td>
                    {e.refCode
                      ? <span className="badge badge-neutral">{e.refCode}</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>
                    {MOCK.vehicles.find(v => v.id === e.vehicleID)?.numbers ?? '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 320 }}>
                    {e.description && e.description.length > 70
                      ? `${e.description.slice(0, 70)}…`
                      : (e.description || '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
