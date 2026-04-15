/**
 * Module-level store for Workshop Technician Rate data.
 */
import { MOCK } from './mockData';

let _rates = MOCK.workshopTechRates.map(r => ({ ...r }));

function nextCode() {
  const max = _rates.reduce((m, r) => {
    const n = parseInt(r.code?.replace('WTR', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `WTR${String(max + 1).padStart(3, '0')}`;
}

export const workshopTechRateStore = {
  getAll:   ()    => [..._rates],
  getById:  (id)  => _rates.find(r => r.id === Number(id)),
  nextCode,
  isCodeUnique: (code, excludeID = null) =>
    !_rates.some(r => r.code === code && r.id !== excludeID),
  /* Prevents duplicate workshop + techCategory combinations */
  isDuplicate: (workshopID, techCategoryID, excludeID = null) =>
    _rates.some(r =>
      r.workshopID    === Number(workshopID)    &&
      r.techCategoryID === Number(techCategoryID) &&
      r.id !== excludeID
    ),

  add: (data) => {
    _rates = [..._rates, { id: Date.now(), ...data }];
  },
  update: (id, data) => {
    _rates = _rates.map(r => r.id === Number(id) ? { ...r, ...data } : r);
  },
  remove: (id) => { _rates = _rates.filter(r => r.id !== Number(id)); },
};
