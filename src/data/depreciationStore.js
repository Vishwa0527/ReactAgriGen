/**
 * Module-level store for Depreciation schedules.
 * One active schedule per fixed asset — defines the annual depreciation rate.
 * ID prefix: 'dep'
 */
import { MOCK } from './mockData';

let _schedules = MOCK.depreciations.map(d => ({ ...d }));

function nextId() {
  return _schedules.length ? Math.max(..._schedules.map(d => d.id)) + 1 : 1;
}

export const depreciationStore = {
  getAll:       ()   => [..._schedules],
  getById:      (id) => _schedules.find(d => d.id === Number(id)),
  getByAssetId: (assetID) => _schedules.filter(d => d.fixedAssetID === Number(assetID)),

  /**
   * Calculate annual straight-line depreciation.
   * Formula: (AssetValue - ResidualValue) / UsefulYears
   */
  calculate: (assetValue, residualValue, usefulYears) => {
    const av = parseFloat(assetValue) || 0;
    const rv = parseFloat(residualValue) || 0;
    const uy = parseInt(usefulYears) || 0;
    if (uy <= 0) return 0;
    return (av - rv) / uy;
  },

  add: (data) => {
    const id = nextId();
    _schedules = [..._schedules, { id, ...data }];
    return id;
  },
  update: (id, data) => {
    _schedules = _schedules.map(d => d.id === Number(id) ? { ...d, ...data } : d);
  },
  remove: (id) => {
    _schedules = _schedules.filter(d => d.id !== Number(id));
  },

  /** Aggregates for dashboard */
  totalBookValue: () => _schedules.reduce((sum, d) => {
    const totalDep = d.depreciationValue * d.usefulYears;
    const elapsed = Math.min(
      d.usefulYears,
      Math.max(0, Math.floor((Date.now() - new Date(d.assetValueDate).getTime()) / (365.25 * 86400000)))
    );
    return sum + Math.max(d.residualValue, d.assetValue - d.depreciationValue * elapsed);
  }, 0),

  fullyDepreciatedCount: () => _schedules.filter(d => {
    const elapsed = Math.floor((Date.now() - new Date(d.assetValueDate).getTime()) / (365.25 * 86400000));
    return elapsed >= d.usefulYears;
  }).length,
};
