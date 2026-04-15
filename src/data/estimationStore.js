/**
 * Module-level store for Estimation (pre-maintenance cost estimates).
 * Header: Estimation — per-asset estimate with line items.
 * Children: EstimationDetail — SKU line items with qty × unitCost.
 * ID prefix: 'est'
 */
import { MOCK } from './mockData';

let _estimations = MOCK.estimations.map(e => ({
  ...e,
  details: e.details?.map(d => ({ ...d })) || [],
}));

function nextCode() {
  const max = _estimations.reduce((m, r) => {
    const n = parseInt(r.estimateCode?.replace('EST-', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `EST-${String(max + 1).padStart(4, '0')}`;
}

function nextDetailId() {
  const allDetails = _estimations.flatMap(e => e.details);
  return allDetails.length ? Math.max(...allDetails.map(d => d.id)) + 1 : 1;
}

export const estimationStore = {
  getAll:       ()   => _estimations.map(e => ({ ...e, details: [...e.details] })),
  getById:      (id) => {
    const e = _estimations.find(r => r.id === Number(id));
    return e ? { ...e, details: [...e.details] } : null;
  },
  getByAssetId: (assetID) => _estimations.filter(e => e.fixedAssetID === Number(assetID)),
  nextCode,
  isCodeUnique: (code, excludeID = null) =>
    !_estimations.some(e => e.estimateCode === code && e.id !== excludeID),

  add: (data) => {
    const id = Date.now();
    const details = (data.details || []).map((d, i) => ({
      ...d,
      id: nextDetailId() + i,
      estimationID: id,
      estimateCode: data.estimateCode,
    }));
    _estimations = [..._estimations, { id, ...data, details }];
    return id;
  },

  update: (id, data) => {
    _estimations = _estimations.map(e => {
      if (e.id !== Number(id)) return e;
      const details = (data.details || e.details).map((d, i) => ({
        ...d,
        id: d.id || nextDetailId() + i,
        estimationID: Number(id),
        estimateCode: data.estimateCode || e.estimateCode,
      }));
      return { ...e, ...data, details };
    });
  },

  remove: (id) => {
    _estimations = _estimations.filter(e => e.id !== Number(id));
  },

  /** Total estimated cost across all records */
  totalEstimatedCost: () => _estimations.reduce((s, e) => s + (e.totalEstimatedCost || 0), 0),
  pendingCount:       () => _estimations.filter(e => e.status === 'Pending').length,
};
