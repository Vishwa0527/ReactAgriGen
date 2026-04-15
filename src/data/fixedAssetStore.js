/**
 * Module-level store for Fixed Asset (core entity of FA module).
 * ID prefix for views: 'far' (listing), 'faf' (form)
 */
import { MOCK } from './mockData';

let _assets = MOCK.fixedAssets.map(a => ({ ...a }));

function nextCode() {
  const max = _assets.reduce((m, a) => {
    const n = parseInt(a.code?.replace('FA-', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `FA-${String(max + 1).padStart(4, '0')}`;
}

export const fixedAssetStore = {
  getAll:       ()    => [..._assets],
  getById:      (id)  => _assets.find(a => a.id === Number(id)),
  nextCode,
  isCodeUnique: (code, excludeID = null) =>
    !_assets.some(a => a.code === code && a.id !== excludeID),

  getByType:     (typeID)   => _assets.filter(a => a.fixedAssetTypeID === Number(typeID)),
  getByCategory: (catID)    => _assets.filter(a => a.fixedAssetCategoryID === Number(catID)),
  getByEstate:   (estateID) => _assets.filter(a => a.estateID === Number(estateID)),

  add: (data) => {
    const id = Date.now();
    _assets = [..._assets, { id, ...data }];
    return id;
  },
  update: (id, data) => {
    _assets = _assets.map(a => a.id === Number(id) ? { ...a, ...data } : a);
  },
  remove: (id) => {
    _assets = _assets.filter(a => a.id !== Number(id));
  },

  /** Aggregate helpers for dashboard */
  totalValue: () => _assets.reduce((sum, a) => sum + (a.totalCostOfAsset || 0), 0),
  totalDepreciation: () => _assets.reduce((sum, a) => sum + (a.depreciationValue || 0), 0),
  activeCount: () => _assets.filter(a => a.status === 'Active').length,
};
