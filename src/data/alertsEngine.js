/**
 * Alerts Engine — derives time-sensitive alerts from existing stores.
 * No new data model; purely computed from current store state.
 *
 * Alert categories:
 *   Driver Licence    — licExpireDate ≤ 30 days
 *   Vehicle Document  — expireDate    ≤ 30 days
 *   Vehicle Service   — nextServiceDate ≤ 14 days (latest record per vehicle)
 *   Depreciation      — schedule end date ≤ 60 days (Active schedules only)
 *   Warranty          — warrantyEndDate ≤ 30 days (non-Disposed assets)
 */
import { MOCK }                from './mockData';
import { driverStore }         from './driverStore';
import { vehicleServiceStore } from './vehicleServiceStore';
import { depreciationStore }   from './depreciationStore';
import { fixedAssetStore }     from './fixedAssetStore';
import { vehicleStore }        from './vehicleStore';

/** Days from today until dateStr. Negative = already passed / overdue. */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

function severity(days) {
  if (days === null) return 'info';
  if (days <= 7)  return 'danger';
  if (days <= 30) return 'warning';
  return 'info';
}

const SEV_ORDER = { danger: 0, warning: 1, info: 2 };

export const alertsEngine = {

  compute() {
    const alerts = [];

    const vehicleMap = Object.fromEntries(vehicleStore.getAll().map(v => [v.id, v]));
    const assetMap   = Object.fromEntries(fixedAssetStore.getAll().map(a => [a.id, a]));
    const docTypeMap = Object.fromEntries((MOCK.documentTypes || []).map(t => [t.id, t.name]));

    /* ── 1. Driver Licence Expiry (≤ 30 days) ── */
    driverStore.getAll().forEach(d => {
      const days = daysUntil(d.licExpireDate);
      if (days === null || days > 30) return;
      alerts.push({
        id:       `lic-${d.id}`,
        category: 'Driver Licence',
        severity: severity(days),
        icon:     'id',
        title:    `${d.name} — licence expiring`,
        subtitle: `Licence No: ${d.licenseNo || '—'}`,
        date:     d.licExpireDate,
        daysUntil: days,
        path:     '/drivers',
      });
    });

    /* ── 2. Vehicle Document Expiry (≤ 30 days) ── */
    (MOCK.vehicleDocuments || []).forEach(doc => {
      if (!doc.expireDate) return;
      const days = daysUntil(doc.expireDate);
      if (days === null || days > 30) return;
      const v = vehicleMap[doc.vehicleID];
      alerts.push({
        id:       `doc-${doc.id}`,
        category: 'Vehicle Document',
        severity: severity(days),
        icon:     'file',
        title:    `${docTypeMap[doc.documentTypeID] || 'Document'} expiring`,
        subtitle: v ? `${v.brand} ${v.model} · ${v.numbers}` : `Vehicle #${doc.vehicleID}`,
        date:     doc.expireDate,
        daysUntil: days,
        path:     '/vehicle-documents',
      });
    });

    /* ── 3. Vehicle Service Due (latest record per vehicle, nextServiceDate ≤ 14 days) ── */
    const latestSvcByVehicle = {};
    vehicleServiceStore.getAll().forEach(svc => {
      if (!svc.nextServiceDate) return;
      const prev = latestSvcByVehicle[svc.vehicleID];
      if (!prev || svc.serviceDate > prev.serviceDate) latestSvcByVehicle[svc.vehicleID] = svc;
    });
    Object.values(latestSvcByVehicle).forEach(svc => {
      const days = daysUntil(svc.nextServiceDate);
      if (days === null || days > 14) return;
      const v = vehicleMap[svc.vehicleID];
      alerts.push({
        id:       `svc-${svc.id}`,
        category: 'Vehicle Service',
        severity: severity(days),
        icon:     'service',
        title:    'Service due',
        subtitle: v ? `${v.brand} ${v.model} · ${v.numbers}` : `Vehicle #${svc.vehicleID}`,
        date:     svc.nextServiceDate,
        daysUntil: days,
        path:     '/vehicle-service',
      });
    });

    /* ── 4. Depreciation Schedule Ending (Active schedules, end date ≤ 60 days) ── */
    depreciationStore.getAll()
      .filter(s => s.status === 'Active' && s.assetValueDate && s.usefulYears)
      .forEach(s => {
        const endDate = new Date(s.assetValueDate);
        endDate.setFullYear(endDate.getFullYear() + Number(s.usefulYears));
        const endStr = endDate.toISOString().slice(0, 10);
        const days   = daysUntil(endStr);
        if (days === null || days > 60) return;
        const a = assetMap[s.fixedAssetID];
        alerts.push({
          id:       `dep-${s.id}`,
          category: 'Depreciation',
          severity: days <= 0 ? 'danger' : 'warning',
          icon:     'chart',
          title:    'Depreciation schedule ending',
          subtitle: a ? `${a.code} — ${a.name}` : `Asset #${s.fixedAssetID}`,
          date:     endStr,
          daysUntil: days,
          path:     '/depreciation',
        });
      });

    /* ── 5. Warranty Expiry (non-Disposed assets, warrantyEndDate ≤ 30 days) ── */
    fixedAssetStore.getAll()
      .filter(a => a.isWarrantyEnabled && a.warrantyEndDate && a.status !== 'Disposed')
      .forEach(a => {
        const days = daysUntil(a.warrantyEndDate);
        if (days === null || days > 30) return;
        alerts.push({
          id:       `war-${a.id}`,
          category: 'Warranty',
          severity: severity(days),
          icon:     'check',
          title:    'Warranty expiring',
          subtitle: `${a.code} — ${a.name}`,
          date:     a.warrantyEndDate,
          daysUntil: days,
          path:     '/assets-register',
        });
      });

    /* Sort: danger first, then by days ascending */
    return alerts.sort((a, b) =>
      (SEV_ORDER[a.severity] ?? 2) - (SEV_ORDER[b.severity] ?? 2) ||
      (a.daysUntil ?? 0) - (b.daysUntil ?? 0)
    );
  },

  totalCount:   () => alertsEngine.compute().length,
  dangerCount:  () => alertsEngine.compute().filter(a => a.severity === 'danger').length,
  warningCount: () => alertsEngine.compute().filter(a => a.severity === 'warning').length,
};
