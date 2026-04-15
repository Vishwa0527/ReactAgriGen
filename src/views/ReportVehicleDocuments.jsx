/**
 * Report: Vehicle Document Status
 * Route: /reports/vehicle-documents
 * ID prefix: rpt-vd
 */
import { useState, useMemo } from 'react';
import { vehicleStore } from '../data/vehicleStore';
import { MOCK }         from '../data/mockData';
import { ReportShell }  from '../components/ReportShell';
import { exportToCsv }  from '../utils/csvExport';

const ID = 'rpt-vd';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function docStatus(expireDate) {
  if (!expireDate) return { label: 'No Expiry', cls: 'badge-neutral' };
  const d = daysUntil(expireDate);
  if (d < 0)  return { label: `${Math.abs(d)}d Overdue`, cls: 'badge-danger' };
  if (d === 0) return { label: 'Expires Today', cls: 'badge-danger' };
  if (d <= 7)  return { label: `${d}d left`, cls: 'badge-danger' };
  if (d <= 30) return { label: `${d}d left`, cls: 'badge-warning' };
  return { label: 'Current', cls: 'badge-success' };
}

export default function ReportVehicleDocuments() {
  const vehicles   = vehicleStore.getAll();
  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));
  const docTypeMap = Object.fromEntries(MOCK.documentTypes.map(t => [t.id, t.name]));

  const allDocs = MOCK.vehicleDocuments;

  const [filterEstateID, setFilterEstateID] = useState('');
  const [filterDocTypeID, setFilterDocTypeID] = useState('');
  const [filterStatusGroup, setFilterStatusGroup] = useState('');  // 'expired'|'expiring'|'current'|''

  const rows = useMemo(() => {
    let r = allDocs;
    if (filterEstateID) {
      r = r.filter(doc => {
        const v = vehicleMap[doc.vehicleID];
        return v?.estateID === Number(filterEstateID);
      });
    }
    if (filterDocTypeID) r = r.filter(doc => doc.documentTypeID === Number(filterDocTypeID));
    if (filterStatusGroup) {
      r = r.filter(doc => {
        if (!doc.expireDate) return filterStatusGroup === 'current';
        const d = daysUntil(doc.expireDate);
        if (filterStatusGroup === 'expired')  return d < 0;
        if (filterStatusGroup === 'expiring') return d >= 0 && d <= 30;
        if (filterStatusGroup === 'current')  return d > 30;
        return true;
      });
    }
    return r;
  }, [allDocs, filterEstateID, filterDocTypeID, filterStatusGroup, vehicleMap]);

  function doExport() {
    exportToCsv('vehicle-document-status.csv',
      ['#', 'Vehicle', 'Reg. No.', 'Document Type', 'Doc. Number', 'Start Date', 'Expire Date', 'Status'],
      rows.map((doc, i) => {
        const v   = vehicleMap[doc.vehicleID];
        const st  = docStatus(doc.expireDate);
        return [
          i + 1,
          v ? `${v.brand} ${v.model}` : `Vehicle #${doc.vehicleID}`,
          v?.numbers || '',
          docTypeMap[doc.documentTypeID] || '',
          doc.docNumber || '',
          doc.startDate  ? fmtDate(doc.startDate)  : '',
          doc.expireDate ? fmtDate(doc.expireDate) : '',
          st.label,
        ];
      })
    );
  }

  const hasFilter = filterEstateID || filterDocTypeID || filterStatusGroup;

  return (
    <ReportShell
      title="Vehicle Document Status"
      subtitle="Vehicle documents with expiry dates and current status"
      onExportCsv={doExport}
    >
      {/* Filters */}
      <div className="card-body" style={{ padding: '12px 20px 0' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <select id={`${ID}-select-estate`} className="form-control" style={{ minWidth: 160 }}
            value={filterEstateID} onChange={e => setFilterEstateID(e.target.value)}>
            <option value="">All Estates</option>
            {MOCK.estates.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select id={`${ID}-select-doctype`} className="form-control" style={{ minWidth: 180 }}
            value={filterDocTypeID} onChange={e => setFilterDocTypeID(e.target.value)}>
            <option value="">All Document Types</option>
            {MOCK.documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select id={`${ID}-select-status`} className="form-control" style={{ minWidth: 150 }}
            value={filterStatusGroup} onChange={e => setFilterStatusGroup(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="expired">Expired / Overdue</option>
            <option value="expiring">Expiring (≤ 30 days)</option>
            <option value="current">Current</option>
          </select>
          {hasFilter && (
            <button id={`${ID}-btn-clear`} className="btn btn-secondary btn-sm"
              onClick={() => { setFilterEstateID(''); setFilterDocTypeID(''); setFilterStatusGroup(''); }}>
              Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} of {allDocs.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card-body" style={{ padding: '0 20px 20px' }}>
        <div className="table-wrap">
          <table className="data-table" id={`${ID}-table`}>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehicle</th>
                <th>Reg. No.</th>
                <th>Document Type</th>
                <th>Doc. Number</th>
                <th>Start Date</th>
                <th>Expire Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>No records found</td></tr>
              ) : rows.map((doc, i) => {
                const v  = vehicleMap[doc.vehicleID];
                const st = docStatus(doc.expireDate);
                return (
                  <tr key={doc.id} id={`${ID}-row-${doc.id}`}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td>{v ? `${v.brand} ${v.model}` : `Vehicle #${doc.vehicleID}`}</td>
                    <td style={{ fontWeight: 600 }}>{v?.numbers || '—'}</td>
                    <td>{docTypeMap[doc.documentTypeID] || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{doc.docNumber || '—'}</td>
                    <td>{fmtDate(doc.startDate)}</td>
                    <td>{doc.expireDate ? fmtDate(doc.expireDate) : <span style={{ color: 'var(--text-muted)' }}>No expiry</span>}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ReportShell>
  );
}
