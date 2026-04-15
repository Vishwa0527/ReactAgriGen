/**
 * Module-level store for Fixed Asset Category data.
 * Each category belongs to a parent FixedAssetType.
 */
import { MOCK } from './mockData';

let _cats = MOCK.fixedAssetCategories.map(c => ({ ...c }));

function nextCode() {
  const max = _cats.reduce((m, c) => {
    const n = parseInt(c.code?.replace('FAC', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `FAC${String(max + 1).padStart(3, '0')}`;
}

export const fixedAssetCategoryStore = {
  getAll:       ()    => [..._cats],
  getById:      (id)  => _cats.find(c => c.id === Number(id)),
  nextCode,
  isCodeUnique: (code, excludeID = null) =>
    !_cats.some(c => c.code === code && c.id !== excludeID),

  add: (data) => {
    _cats = [..._cats, { id: Date.now(), ...data }];
  },
  update: (id, data) => {
    _cats = _cats.map(c => c.id === Number(id) ? { ...c, ...data } : c);
  },
  remove: (id) => { _cats = _cats.filter(c => c.id !== Number(id)); },
};
