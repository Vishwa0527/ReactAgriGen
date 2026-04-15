/**
 * Module-level store for Workshop data.
 */
import { MOCK } from './mockData';

let _workshops = MOCK.workshops.map(w => ({ ...w }));

function nextCode() {
  const max = _workshops.reduce((m, w) => {
    const n = parseInt(w.code?.replace('WS', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `WS${String(max + 1).padStart(3, '0')}`;
}

export const workshopStore = {
  getAll:       ()    => [..._workshops],
  getById:      (id)  => _workshops.find(w => w.id === Number(id)),
  nextCode,
  isCodeUnique: (code, excludeID = null) =>
    !_workshops.some(w => w.code === code && w.id !== excludeID),

  add: (data) => {
    _workshops = [..._workshops, { id: Date.now(), ...data }];
  },
  update: (id, data) => {
    _workshops = _workshops.map(w => w.id === Number(id) ? { ...w, ...data } : w);
  },
  remove: (id) => { _workshops = _workshops.filter(w => w.id !== Number(id)); },
};
