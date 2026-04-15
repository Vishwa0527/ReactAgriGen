/**
 * Module-level store for Driver data.
 * Shared between Drivers (listing) and DriverForm (add/edit).
 * State persists across route transitions without Redux/Context.
 */
import { MOCK } from './mockData';

let _drivers = MOCK.drivers.map(d => ({ ...d }));

function nextCode() {
  const max = _drivers.reduce((m, d) => {
    const n = parseInt(d.code?.replace('DRV', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `DRV${String(max + 1).padStart(3, '0')}`;
}

export const driverStore = {
  getAll:   ()    => [..._drivers],
  getById:  (id)  => _drivers.find(d => d.id === Number(id)),
  nextCode,

  add: (data) => {
    _drivers = [..._drivers, { id: Date.now(), ...data }];
  },

  update: (id, data) => {
    _drivers = _drivers.map(d => d.id === Number(id) ? { ...d, ...data } : d);
  },

  remove: (id) => { _drivers = _drivers.filter(d => d.id !== Number(id)); },
};
