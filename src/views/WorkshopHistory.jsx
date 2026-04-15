import { useState, useMemo } from 'react';
import { MOCK }                  from '../data/mockData';
import { maintenanceTaskStore }  from '../data/maintenanceTaskStore';
import { jobCardStore }          from '../data/jobCardStore';
import { maintenanceRecordStore } from '../data/maintenanceRecordStore';
import { vehicleServiceStore }   from '../data/vehicleServiceStore';
import { workshopStore }         from '../data/workshopStore';
import { workshopCategoryStore } from '../data/workshopCategoryStore';

const ID = 'wh';

/* ── Event type visual config ── */
const EVENT_STYLE = {
  'Maintenance Task':   { background: 'var(--primary-light)', color: 'var(--primary-dark)', border: '1px solid var(--primary)' },
  'Job Card':           { background: '#ede9fe', color: '#5b21b6',  border: '1px solid #a78bfa' },
  'Maintenance Record': { background: '#fef3c7', color: '#92400e',  border: '1px solid #fde68a' },
  'Vehicle Service':    { background: '#dcfce7', color: '#166534',  border: '1px solid #86efac' },
};

const EVENT_TYPES = Object.keys(EVENT_STYLE);

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function TypeBadge({ type }) {
  const s = EVENT_STYLE[type] ?? {};
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

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ flex: 1, padding: '14px 18px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function WorkshopHistory() {
  const [fromDate,          setFromDate]          = useState('');
  const [toDate,            setToDate]            = useState('');
  const [filterCategoryID,  setFilterCategoryID]  = useState('');
  const [filterWsID,        setFilterWsID]        = useState('');
  const [filterVehicleID,   setFilterVehicleID]   = useState('');
  const [filterType,        setFilterType]        = useState('');

  const allWs         = workshopStore.getAll();
  const allCategories = workshopCategoryStore.getAll();

  /* Workshops scoped to selected category (for the workshop dropdown) */
  const visibleWs = filterCategoryID
    ? allWs.filter(w => w.workshopCategoryID === Number(filterCategoryID))
    : allWs;

  const handleCategoryChange = (val) => {
    setFilterCategoryID(val);
    // Reset workshop filter if it no longer belongs to the new category
    if (val && filterWsID) {
      const ws = allWs.find(w => w.id === Number(filterWsID));
      if (ws && ws.workshopCategoryID !== Number(val)) setFilterWsID('');
    }
  };

  /* ── Build combined event list from all 4 sources ── */
  const allEvents = useMemo(() => {
    const tasks = maintenanceTaskStore.getAll().map(t => ({
      id:          `mt-${t.id}`,
      type:        'Maintenance Task',
      date:        t.date,
      refCode:     t.refCode,
      vehicleID:   t.vehicleID,
      workshopID:  t.workshopID,
      description: `${t.mode} · ${t.taskType}`,
      cost:        t.costTotal,
    }));

    const cards = jobCardStore.getAll().map(c => {
      const taskRef = maintenanceTaskStore.getById(c.maintenanceTaskID)?.refCode ?? `Task #${c.maintenanceTaskID}`;
      return {
        id:          `jc-${c.id}`,
        type:        'Job Card',
        date:        c.startTime?.substring(0, 10) ?? '',
        refCode:     taskRef,
        vehicleID:   c.vehicleID,
        workshopID:  c.workshopID,
        description: c.description,
        cost:        c.costOfService ?? 0,
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
        workshopID:  r.workshopID,
        description: r.description,
        cost:        r.costOfService,
      };
    });

    const services = vehicleServiceStore.getAll().map(s => {
      const taskRef = maintenanceTaskStore.getById(s.maintenanceTaskID)?.refCode ?? '—';
      return {
        id:          `vs-${s.id}`,
        type:        'Vehicle Service',
        date:        s.serviceDate,
        refCode:     taskRef,
        vehicleID:   s.vehicleID,
        workshopID:  s.workshopID,
        description: `Service at ${Number(s.odometer).toLocaleString()} km`,
        cost:        s.costAmount,
      };
    });

    return [...tasks, ...cards, ...records, ...services]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, []);

  /* ── Enrich each event with vehicle / workshop names ── */
  const enriched = useMemo(() => allEvents.map(e => ({
    ...e,
    _vehicle:  MOCK.vehicles.find(v => v.id === e.vehicleID),
    _workshop: allWs.find(w => w.id === e.workshopID),
  })), [allEvents]);

  /* ── Apply filters ── */
  const filtered = useMemo(() => enriched.filter(e => {
    if (filterCategoryID) {
      const ws = allWs.find(w => w.id === e.workshopID);
      if (!ws || ws.workshopCategoryID !== Number(filterCategoryID)) return false;
    }
    if (filterType      && e.type        !== filterType)               return false;
    if (filterWsID      && e.workshopID  !== Number(filterWsID))      return false;
    if (filterVehicleID && e.vehicleID   !== Number(filterVehicleID)) return false;
    if (fromDate        && e.date        <  fromDate)                  return false;
    if (toDate          && e.date        >  toDate)                    return false;
    return true;
  }), [enriched, filterCategoryID, filterType, filterWsID, filterVehicleID, fromDate, toDate, allWs]);

  /* ── Summary KPIs ── */
  const totalCost  = filtered.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const byType     = EVENT_TYPES.map(t => ({ type: t, count: filtered.filter(e => e.type === t).length }));
  const isFiltered = filterCategoryID || filterType || filterWsID || filterVehicleID || fromDate || toDate;

  const clearFilters = () => {
    setFromDate(''); setToDate('');
    setFilterCategoryID(''); setFilterWsID(''); setFilterVehicleID(''); setFilterType('');
  };

  return (
    <div className="fade-up">

      {/* ── Filter bar ── */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* Date range */}
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

          {/* Workshop Category */}
          <select
            id={`${ID}-select-category`}
            className="form-control"
            style={{ minWidth: 185 }}
            value={filterCategoryID}
            onChange={e => handleCategoryChange(e.target.value)}
          >
            <option value="">— All Categories —</option>
            {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Workshop */}
          <select
            id={`${ID}-select-workshop`}
            className="form-control"
            style={{ minWidth: 190 }}
            value={filterWsID}
            onChange={e => setFilterWsID(e.target.value)}
          >
            <option value="">— All Workshops —</option>
            {visibleWs.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>

          {/* Vehicle */}
          <select
            id={`${ID}-select-vehicle`}
            className="form-control"
            style={{ minWidth: 190 }}
            value={filterVehicleID}
            onChange={e => setFilterVehicleID(e.target.value)}
          >
            <option value="">— All Vehicles —</option>
            {MOCK.vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.numbers} — {v.brand} {v.model}</option>
            ))}
          </select>

          {/* Event type */}
          <select
            id={`${ID}-select-type`}
            className="form-control"
            style={{ minWidth: 170 }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">— All Event Types —</option>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {isFiltered && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Clear
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} of {allEvents.length} events
          </span>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard label="Total Events" value={filtered.length} sub={isFiltered ? 'Filtered' : 'All time'} color="var(--primary)" />
        <KpiCard label="Total Cost" value={`Rs. ${totalCost.toLocaleString()}`} sub="Across filtered events" color="#8b5cf6" />
        {byType.filter(b => b.count > 0).map(b => (
          <KpiCard
            key={b.type}
            label={b.type}
            value={b.count}
            color={EVENT_STYLE[b.type]?.border?.replace('1px solid ', '') ?? '#ccc'}
          />
        ))}
      </div>

      {/* ── Event table ── */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          <div>
            <div className="card-header-title">Workshop Event Log</div>
            <div className="card-header-sub">Maintenance tasks, job cards, records and vehicle services — sorted newest first</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Task Ref</th>
                <th>Vehicle / Machinery</th>
                <th>Workshop</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Cost (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                    No events match the current filters.
                  </td>
                </tr>
              ) : filtered.map(e => (
                <tr key={e.id}>
                  <td><TypeBadge type={e.type} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                  <td>
                    {e.refCode && e.refCode !== '—'
                      ? <span className="badge badge-neutral">{e.refCode}</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{e._vehicle?.numbers ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e._workshop?.name ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260 }}>
                    {e.description && e.description.length > 55 ? `${e.description.slice(0, 55)}…` : (e.description || '—')}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {Number(e.cost) > 0 ? Number(e.cost).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-page)' }}>
                  <td colSpan={6} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Total Cost — {filtered.length} events
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Rs. {totalCost.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
