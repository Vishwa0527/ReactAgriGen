/**
 * Module-level store for Fixed Asset Type data.
 */
import { MOCK } from './mockData';

let _types = MOCK.fixedAssetTypes.map(t => ({ ...t }));

function nextCode() {
  const max = _types.reduce((m, t) => {
    const n = parseInt(t.code?.replace('FA', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `FA${String(max + 1).padStart(3, '0')}`;
}

export const fixedAssetTypeStore = {
  getAll:       ()    => [..._types],
  getById:      (id)  => _types.find(t => t.id === Number(id)),
  nextCode,
  isCodeUnique: (code, excludeID = null) =>
    !_types.some(t => t.code === code && t.id !== excludeID),

  add: (data) => {
    _types = [..._types, { id: Date.now(), ...data }];
  },
  update: (id, data) => {
    _types = _types.map(t => t.id === Number(id) ? { ...t, ...data } : t);
  },
  remove: (id) => { _types = _types.filter(t => t.id !== Number(id)); },
};
