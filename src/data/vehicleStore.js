/**
 * Module-level store for Vehicle data and Vehicle History.
 * Shared between Vehicles (listing), VehicleForm (add/edit), and VehicleHistory (view).
 * State persists across route transitions without Redux/Context.
 */
import { MOCK } from './mockData';

let _vehicles = MOCK.vehicles.map(v => ({
  secondaryFuelTypeID: null,
  residualValue:       0,
  depreciationValue:   0,
  fixedAssetID:        null,
  ...v,
}));

/* Seed history with one "Created" entry per existing vehicle */
let _history = MOCK.vehicles.map((v, i) => ({
  id: i + 1,
  vehicleID: v.id,
  action: 'Created',
  timestamp: v.registerYear ? `${v.registerYear}T08:00:00.000Z` : new Date().toISOString(),
  snapshot: {
    secondaryFuelTypeID: null,
    residualValue:       v.residualValue       || 0,
    depreciationValue:   v.depreciationValue   || 0,
    ...v,
  },
}));

export const vehicleStore = {
  getAll:  ()    => [..._vehicles],
  getById: (id)  => _vehicles.find(v => v.id === Number(id)),

  add: (data) => {
    const newId   = Date.now();
    const vehicle = { id: newId, status: 'Active', ...data };
    _vehicles = [..._vehicles, vehicle];
    _history  = [..._history, {
      id:        newId + 1,
      vehicleID: newId,
      action:    'Created',
      timestamp: new Date().toISOString(),
      snapshot:  { ...vehicle },
    }];
  },

  update: (id, data) => {
    _vehicles = _vehicles.map(v => v.id === Number(id) ? { ...v, ...data } : v);
    const updated = _vehicles.find(v => v.id === Number(id));
    _history = [..._history, {
      id:        Date.now(),
      vehicleID: Number(id),
      action:    'Updated',
      timestamp: new Date().toISOString(),
      snapshot:  { ...updated },
    }];
  },

  remove: (id) => { _vehicles = _vehicles.filter(v => v.id !== Number(id)); },

  /* Returns all history entries newest-first */
  getHistory: () => [..._history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
};
