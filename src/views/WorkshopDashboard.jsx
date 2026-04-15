import { useState, useMemo } from 'react';
import { workshopStore }         from '../data/workshopStore';
import { workshopCategoryStore } from '../data/workshopCategoryStore';
import { workshopStockStore }   from '../data/workshopStockStore';
import { maintenanceTaskStore } from '../data/maintenanceTaskStore';
import { jobCardStore }         from '../data/jobCardStore';
import { itemIssueStore }       from '../data/itemIssueStore';
import { MOCK }                 from '../data/mockData';

const ID = 'wd';

/* ── helpers ── */
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtDateTime(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('en-LK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return s; }
}

const MODE_STYLE = {
  Scheduled:  { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  Preventive: { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  Breakdown:  { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  Inspection: { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' },
};

const STATUS_OPTIONS = ['OK', 'Low Stock', 'Out of Stock'];

/* ── KPI card ── */
function KpiCard({ id, label, value, sub, accent }) {
  return (
    <div id={id} className="card" style={{ flex: 1, minWidth: 150, padding: '18px 20px', borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ── Section header ── */
function SectionHeader({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({count} total)</span>
      )}
    </div>
  );
}

/* ── Empty state ── */
function EmptyRow({ cols, message }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        {message}
      </td>
    </tr>
  );
}

export default function WorkshopDashboard() {
  const allWs         = workshopStore.getAll();
  const allCategories = workshopCategoryStore.getAll();

  /* ── Category filter — default to 'Vehicle Workshop' ── */
  const defaultCatID = allCategories.find(c => c.name === 'Vehicle Workshop')?.id ?? null;
  const [filterCategoryID, setFilterCategoryID] = useState(defaultCatID);

  /* Derive label for the "vehicle / machinery" concept based on selected category */
  const selectedCat = allCategories.find(c => c.id === filterCategoryID);
  const entityLabel = selectedCat?.name === 'Agricultural Equip.' ? 'Machinery'
    : selectedCat?.name === 'Electrical Works' ? 'Equipment'
    : 'Vehicle';

  /* Workshops visible in the selector (scoped to selected category) */
  const categoryWs = filterCategoryID
    ? allWs.filter(w => w.workshopCategoryID === filterCategoryID)
    : allWs;

  /* ── Workshop selector ── */
  const [selectedWsID, setSelectedWsID] = useState(() => {
    const ws = defaultCatID ? allWs.filter(w => w.workshopCategoryID === defaultCatID) : allWs;
    return ws[0]?.id ?? null;
  });
  const selectedWs = allWs.find(w => w.id === selectedWsID);

  /* When category changes: keep current workshop if it belongs to the new category,
     otherwise auto-select the first workshop in the new list; reset vehicle filter */
  const handleCategoryChange = (catID) => {
    setFilterCategoryID(catID);
    setFilterVehicleID('');
    const ws = catID !== null ? allWs.filter(w => w.workshopCategoryID === catID) : allWs;
    if (!ws.find(w => w.id === selectedWsID)) {
      setSelectedWsID(ws[0]?.id ?? null);
    }
  };

  /* ── Top filters (tasks & job cards) ── */
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [filterEstateID, setFilterEstateID] = useState('');
  const [filterVehicleID, setFilterVehicleID] = useState('');

  /* ── Inventory filters ── */
  const [invSearch,   setInvSearch]   = useState('');
  const [invStatus,   setInvStatus]   = useState('');
  const [invFromDate, setInvFromDate] = useState('');
  const [invToDate,   setInvToDate]   = useState('');

  /* ── Category + estate-scoped vehicle/machinery list for dropdown ── */
  const vehicleOptions = useMemo(() => {
    let list = MOCK.vehicles;
    // For agricultural category, show only tractors (vehicleTypeID 4)
    if (filterCategoryID) {
      const cat = allCategories.find(c => c.id === filterCategoryID);
      if (cat?.name === 'Agricultural Equip.') list = list.filter(v => v.vehicleTypeID === 4);
    }
    if (filterEstateID) list = list.filter(v => v.estateID === Number(filterEstateID));
    return list;
  }, [filterCategoryID, filterEstateID, allCategories]);

  /* ── Vehicle IDs in the selected estate (for task/card filtering) ── */
  const estateVehicleIDs = useMemo(() => {
    if (!filterEstateID) return null;
    return new Set(MOCK.vehicles.filter(v => v.estateID === Number(filterEstateID)).map(v => v.id));
  }, [filterEstateID]);

  /* ── Tasks filtered by workshop + date + estate + vehicle ── */
  const wsTasks = useMemo(() => {
    if (!selectedWsID) return [];
    return maintenanceTaskStore.getAll().filter(t => {
      if (t.workshopID !== selectedWsID)                    return false;
      if (fromDate && t.date < fromDate)                    return false;
      if (toDate   && t.date > toDate)                      return false;
      if (filterVehicleID && t.vehicleID !== Number(filterVehicleID)) return false;
      if (!filterVehicleID && estateVehicleIDs && !estateVehicleIDs.has(t.vehicleID)) return false;
      return true;
    });
  }, [selectedWsID, fromDate, toDate, filterVehicleID, estateVehicleIDs]);

  /* ── Job cards filtered by workshop + date + estate + vehicle ── */
  const wsCards = useMemo(() => {
    if (!selectedWsID) return [];
    return jobCardStore.getAll()
      .filter(c => {
        if (c.workshopID !== selectedWsID) return false;
        const cardDate = c.startTime?.substring(0, 10) ?? '';
        if (fromDate && cardDate < fromDate) return false;
        if (toDate   && cardDate > toDate)   return false;
        if (filterVehicleID && c.vehicleID !== Number(filterVehicleID)) return false;
        if (!filterVehicleID && estateVehicleIDs && !estateVehicleIDs.has(c.vehicleID)) return false;
        return true;
      })
      .sort((a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? ''));
  }, [selectedWsID, fromDate, toDate, filterVehicleID, estateVehicleIDs]);

  /* ── Raw stock for selected workshop (unfiltered) ── */
  const wsStockRaw = useMemo(() => {
    if (!selectedWsID) return [];
    return workshopStockStore.getByWorkshop(selectedWsID).map(s => {
      const sku = MOCK.skuMaster.find(sk => sk.id === s.skuID);
      return { ...s, _skuCode: sku?.code ?? '—', _skuName: sku?.name ?? '—', _unit: sku?.unit ?? '' };
    });
  }, [selectedWsID]);

  /* ── SKUs that had item issues to this workshop within the inventory date range ── */
  const invDateSkuIDs = useMemo(() => {
    if (!invFromDate && !invToDate) return null;
    const matchedSkus = new Set(
      itemIssueStore.getAll()
        .filter(iss =>
          iss.issueType === 'Workshop' &&
          Number(iss.targetID) === selectedWsID &&
          (!invFromDate || iss.issueDate >= invFromDate) &&
          (!invToDate   || iss.issueDate <= invToDate)
        )
        .flatMap(iss => iss.items.map(i => Number(i.skuID)))
    );
    return matchedSkus;
  }, [selectedWsID, invFromDate, invToDate]);

  /* ── Inventory with filters applied ── */
  const wsStock = useMemo(() => {
    let items = wsStockRaw;

    if (invSearch) {
      const q = invSearch.toLowerCase();
      items = items.filter(s =>
        s._skuCode.toLowerCase().includes(q) || s._skuName.toLowerCase().includes(q)
      );
    }

    if (invStatus === 'Out of Stock') items = items.filter(s => s.balance === 0);
    else if (invStatus === 'Low Stock') items = items.filter(s => s.balance > 0 && s.balance <= 5);
    else if (invStatus === 'OK')        items = items.filter(s => s.balance > 5);

    if (invDateSkuIDs !== null) {
      items = invDateSkuIDs.size > 0
        ? items.filter(s => invDateSkuIDs.has(Number(s.skuID)))
        : [];
    }

    return items;
  }, [wsStockRaw, invSearch, invStatus, invDateSkuIDs]);

  /* ── KPI values ── */
  const totalStockValue = useMemo(
    () => wsStock.reduce((sum, s) => sum + s.balance * s.unitCost, 0),
    [wsStock],
  );

  /* ── Recent slices (6 each) ── */
  const recentTasks = wsTasks.slice(0, 6);
  const recentCards = wsCards.slice(0, 6);

  /* ── Enrichment helpers ── */
  const enrichTask = t => ({ ...t, _vehicle: MOCK.vehicles.find(v => v.id === t.vehicleID) });
  const enrichCard = c => ({
    ...c,
    _vehicle: MOCK.vehicles.find(v => v.id === c.vehicleID),
    _task:    maintenanceTaskStore.getById(c.maintenanceTaskID),
  });

  /* ── Active filter checks ── */
  const isTopFiltered = fromDate || toDate || filterEstateID || filterVehicleID;
  const isInvFiltered = invSearch || invStatus || invFromDate || invToDate;

  const clearTopFilters = () => { setFromDate(''); setToDate(''); setFilterEstateID(''); setFilterVehicleID(''); };
  const clearInvFilters = () => { setInvSearch(''); setInvStatus(''); setInvFromDate(''); setInvToDate(''); };

  /* ── When estate changes, reset vehicle ── */
  const handleEstateChange = (e) => { setFilterEstateID(e.target.value); setFilterVehicleID(''); };

  return (
    <div className="fade-up">

      {/* ── Workshop Selector ── */}
      <div className="card" style={{ marginBottom: 14, padding: '14px 20px' }}>

        {/* Category filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Category
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              id={`${ID}-btn-cat-all`}
              type="button"
              onClick={() => handleCategoryChange(null)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 600,
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer',
                background: filterCategoryID === null ? 'var(--primary)' : 'var(--bg-card)',
                color:      filterCategoryID === null ? '#fff'           : 'var(--text-secondary)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              All
            </button>
            {allCategories.map(cat => (
              <button
                key={cat.id}
                id={`${ID}-btn-cat-${cat.id}`}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                style={{
                  padding: '4px 12px', fontSize: 12, fontWeight: 600,
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer',
                  background: filterCategoryID === cat.id ? 'var(--primary)' : 'var(--bg-card)',
                  color:      filterCategoryID === cat.id ? '#fff'           : 'var(--text-secondary)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Workshop buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Workshop
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categoryWs.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No workshops in this category
              </span>
            ) : categoryWs.map(ws => (
              <button
                key={ws.id}
                id={`${ID}-btn-ws-${ws.id}`}
                type="button"
                onClick={() => setSelectedWsID(ws.id)}
                style={{
                  padding: '5px 14px', fontSize: 13, fontWeight: 600,
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer',
                  background: selectedWsID === ws.id ? 'var(--primary)' : 'var(--bg-card)',
                  color:      selectedWsID === ws.id ? '#fff'           : 'var(--text-secondary)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {ws.code} — {ws.name}
              </button>
            ))}
          </div>
          {selectedWs && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {selectedWs.location}
            </span>
          )}
        </div>
      </div>

      {/* ── Activity Filters (tasks & job cards) ── */}
      <div className="card" style={{ marginBottom: 20, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Filter Activity
          </span>

          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From</span>
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

          {/* Estate */}
          <select
            id={`${ID}-select-estate`}
            className="form-control"
            style={{ minWidth: 190 }}
            value={filterEstateID}
            onChange={handleEstateChange}
          >
            <option value="">— All Estates —</option>
            {MOCK.estates.map(es => <option key={es.id} value={es.id}>{es.name}</option>)}
          </select>

          {/* Vehicle / Machinery */}
          <select
            id={`${ID}-select-vehicle`}
            className="form-control"
            style={{ minWidth: 190 }}
            value={filterVehicleID}
            onChange={e => setFilterVehicleID(e.target.value)}
          >
            <option value="">— All {entityLabel}s —</option>
            {vehicleOptions.map(v => (
              <option key={v.id} value={v.id}>{v.numbers} — {v.brand} {v.model}</option>
            ))}
          </select>

          {isTopFiltered && (
            <button id={`${ID}-btn-clear-top`} className="btn btn-secondary btn-sm" onClick={clearTopFilters}>
              Clear
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {wsTasks.length} tasks · {wsCards.length} cards
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard
          id={`${ID}-kpi-tasks`}
          label="Maintenance Tasks"
          value={wsTasks.length}
          sub={isTopFiltered ? 'Filtered' : 'This workshop'}
          accent="var(--primary)"
        />
        <KpiCard
          id={`${ID}-kpi-cards`}
          label="Job Cards"
          value={wsCards.length}
          sub={isTopFiltered ? 'Filtered' : 'This workshop'}
          accent="#8b5cf6"
        />
        <KpiCard
          id={`${ID}-kpi-sku-types`}
          label="SKU Types in Stock"
          value={wsStockRaw.length}
          sub={wsStockRaw.filter(s => s.balance === 0).length > 0
            ? `${wsStockRaw.filter(s => s.balance === 0).length} out of stock`
            : 'All stocked'
          }
          accent="#10b981"
        />
        <KpiCard
          id={`${ID}-kpi-stock-value`}
          label="Total Stock Value"
          value={`Rs. ${workshopStockStore.totalValue(selectedWsID ?? 0).toLocaleString()}`}
          sub="Current inventory balance"
          accent="#f59e0b"
        />
      </div>

      {/* ── Main content grid (tasks + job cards) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Maintenance Tasks */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
            <SectionHeader title="Recent Maintenance Tasks" count={wsTasks.length} />
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Date</th>
                  <th>{entityLabel}</th>
                  <th>Mode</th>
                  <th style={{ textAlign: 'right' }}>Cost (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.length === 0 ? (
                  <EmptyRow cols={5} message={isTopFiltered ? 'No tasks match the current filters' : 'No maintenance tasks for this workshop'} />
                ) : recentTasks.map(t => {
                  const et = enrichTask(t);
                  return (
                    <tr key={t.id}>
                      <td><span className="badge badge-neutral">{t.refCode}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDate(t.date)}</td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{et._vehicle?.numbers ?? '—'}</td>
                      <td>
                        <span style={{
                          ...(MODE_STYLE[t.mode] ?? {}),
                          padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                          fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block',
                        }}>
                          {t.mode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                        {Number(t.costTotal ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job Cards */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
            <SectionHeader title="Recent Job Cards" count={wsCards.length} />
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Start</th>
                  <th>{entityLabel}</th>
                  <th style={{ textAlign: 'right' }}>Cost (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {recentCards.length === 0 ? (
                  <EmptyRow cols={4} message={isTopFiltered ? 'No job cards match the current filters' : 'No job cards for this workshop'} />
                ) : recentCards.map(c => {
                  const ec = enrichCard(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                          {ec._task?.refCode ?? `#${c.maintenanceTaskID}`}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDateTime(c.startTime)}</td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{ec._vehicle?.numbers ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                        {Number(c.costOfService ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Workshop Inventory Balance ── */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 0 }}>
          <div>
            <div className="card-header-title">Workshop Inventory Balance</div>
            <div className="card-header-sub">Current stock levels for {selectedWs?.name ?? 'selected workshop'}</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            {wsStock.length} of {wsStockRaw.length} SKUs
          </span>
        </div>

        {/* Inventory filter bar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* SKU search */}
          <input
            id={`${ID}-input-sku-search`}
            type="text"
            className="form-control"
            style={{ width: 200 }}
            placeholder="Search SKU code or name…"
            value={invSearch}
            onChange={e => setInvSearch(e.target.value)}
          />

          {/* Status */}
          <select
            id={`${ID}-select-inv-status`}
            className="form-control"
            style={{ minWidth: 160 }}
            value={invStatus}
            onChange={e => setInvStatus(e.target.value)}
          >
            <option value="">— All Statuses —</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Issued date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Issued From</span>
            <input
              id={`${ID}-input-inv-from`}
              type="date"
              className="form-control"
              style={{ width: 150 }}
              value={invFromDate}
              onChange={e => setInvFromDate(e.target.value)}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To</span>
            <input
              id={`${ID}-input-inv-to`}
              type="date"
              className="form-control"
              style={{ width: 150 }}
              value={invToDate}
              onChange={e => setInvToDate(e.target.value)}
            />
          </div>

          {isInvFiltered && (
            <button id={`${ID}-btn-clear-inv`} className="btn btn-secondary btn-sm" onClick={clearInvFilters}>
              Clear
            </button>
          )}
        </div>

        {/* Inventory table */}
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Name</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ textAlign: 'right' }}>Unit Cost (Rs.)</th>
                <th style={{ textAlign: 'right' }}>Value (Rs.)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wsStock.length === 0 ? (
                <EmptyRow cols={7} message={isInvFiltered ? 'No inventory items match the current filters' : 'No inventory items recorded for this workshop'} />
              ) : wsStock.map(s => {
                const value = s.balance * s.unitCost;
                const isOut = s.balance === 0;
                const isLow = !isOut && s.balance <= 5;

                return (
                  <tr key={s.id}>
                    <td><span className="badge badge-neutral">{s._skuCode}</span></td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{s._skuName}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s._unit}</td>
                    <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700,
                      color: isOut ? 'var(--danger)' : isLow ? '#d97706' : 'var(--text-primary)' }}>
                      {s.balance}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>{Number(s.unitCost).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{Number(value).toLocaleString()}</td>
                    <td>
                      {isOut ? (
                        <span style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 'var(--radius-sm)', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', display: 'inline-block' }}>
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 'var(--radius-sm)', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', display: 'inline-block' }}>
                          Low Stock
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 'var(--radius-sm)', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', display: 'inline-block' }}>
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {wsStock.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-page)' }}>
                  <td colSpan={5} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Total Stock Value{isInvFiltered ? ' (filtered)' : ''}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Rs. {totalStockValue.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
