/**
 * Module-level store for Asset Maintenance (financial / accounting impact).
 * Header: AssetMaintenance — per-asset maintenance event.
 * Children: details (employee assignments) + costs (cost breakdown).
 * ID prefix: 'am' (listing), 'amf' (form)
 */
import { MOCK } from './mockData';

let _maintenances = MOCK.assetMaintenances.map(m => ({
  ...m,
  details: m.details?.map(d => ({ ...d })) || [],
  costs:   m.costs?.map(c => ({ ...c })) || [],
}));

function nextCode() {
  const max = _maintenances.reduce((m, r) => {
    const n = parseInt(r.maintenanceCode?.replace('AM-', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `AM-${String(max + 1).padStart(4, '0')}`;
}

function nextId(arr) {
  return arr.length ? Math.max(...arr.map(r => r.id)) + 1 : 1;
}

function nextDetailId() {
  const allDetails = _maintenances.flatMap(m => m.details);
  return nextId(allDetails);
}

function nextCostId() {
  const allCosts = _maintenances.flatMap(m => m.costs);
  return nextId(allCosts);
}

export const assetMaintenanceStore = {
  getAll:         ()   => _maintenances.map(m => ({ ...m, details: [...m.details], costs: [...m.costs] })),
  getById:        (id) => {
    const m = _maintenances.find(r => r.id === Number(id));
    return m ? { ...m, details: [...m.details], costs: [...m.costs] } : null;
  },
  getByAssetId:   (assetID)    => _maintenances.filter(m => m.fixedAssetID === Number(assetID)),
  getByWorkshopId:(workshopID) => _maintenances.filter(m => m.workshopID === Number(workshopID)),
  nextCode,
  isCodeUnique:   (code, excludeID = null) =>
    !_maintenances.some(m => m.maintenanceCode === code && m.id !== excludeID),

  add: (data) => {
    const id = Date.now();
    const details = (data.details || []).map((d, i) => ({ ...d, id: nextDetailId() + i, maintenanceID: id }));
    const costs = (data.costs || []).map((c, i) => ({ ...c, id: nextCostId() + i, maintenanceID: id }));
    _maintenances = [..._maintenances, { id, ...data, details, costs }];
    return id;
  },

  update: (id, data) => {
    _maintenances = _maintenances.map(m => {
      if (m.id !== Number(id)) return m;
      const details = (data.details || m.details).map((d, i) => ({
        ...d,
        id: d.id || nextDetailId() + i,
        maintenanceID: Number(id),
      }));
      const costs = (data.costs || m.costs).map((c, i) => ({
        ...c,
        id: c.id || nextCostId() + i,
        maintenanceID: Number(id),
      }));
      return { ...m, ...data, details, costs };
    });
  },

  remove: (id) => {
    _maintenances = _maintenances.filter(m => m.id !== Number(id));
  },

  /** Total maintenance cost for all records */
  totalCost: () => _maintenances.reduce((s, m) => s + (m.totalMaintenanceCost || 0), 0),
};
