/**
 * Module-level store for Vehicle data and Vehicle History.
 * Shared between Vehicles (listing), VehicleForm (add/edit), and VehicleHistory (view).
 * State persists across route transitions without Redux/Context.
 *
 * History entries include a `changedFields` array (human-readable labels) so the
 * VehicleHistory screen can show exactly what changed on each 'Updated' event.
 */
import { MOCK } from './mockData';

/** Fields tracked for change detection — key: human-readable label */
const TRACKED_FIELDS = {
  numbers:             'Reg. No.',
  brand:               'Brand',
  model:               'Model',
  status:              'Status',
  estateID:            'Estate',
  groupID:             'Group',
  vehicleTypeID:       'Vehicle Type',
  fixedAssetTypeID:    'Asset Type',
  fuelTypeID:          'Primary Fuel',
  secondaryFuelTypeID: 'Secondary Fuel',
  capacity:            'Capacity',
  registerYear:        'Reg. Year',
  fixedAssetID:        'Linked Asset',
  costOfAsset:         'Cost',
  usefulLifeYears:     'Useful Life',
  residualValue:       'Residual Value',
  depreciationValue:   'Depreciation',
};

function diffFields(oldVehicle, newData) {
  if (!oldVehicle) return [];
  return Object.keys(TRACKED_FIELDS).filter(k =>
    newData[k] !== undefined &&
    String(oldVehicle[k] ?? '') !== String(newData[k] ?? '')
  ).map(k => TRACKED_FIELDS[k]);
}

let _vehicles = MOCK.vehicles.map(v => ({
  secondaryFuelTypeID: null,
  residualValue:       0,
  depreciationValue:   0,
  fixedAssetID:        null,
  ...v,
}));

/* Seed history with one "Created" entry per existing vehicle */
let _history = MOCK.vehicles.map((v, i) => ({
  id:            i + 1,
  vehicleID:     v.id,
  action:        'Created',
  changedFields: [],
  timestamp:     v.registerYear ? `${v.registerYear}T08:00:00.000Z` : new Date().toISOString(),
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
      id:            newId + 1,
      vehicleID:     newId,
      action:        'Created',
      changedFields: [],
      timestamp:     new Date().toISOString(),
      snapshot:      { ...vehicle },
    }];
  },

  update: (id, data) => {
    const old          = _vehicles.find(v => v.id === Number(id));
    const changedFields = diffFields(old, data);
    _vehicles = _vehicles.map(v => v.id === Number(id) ? { ...v, ...data } : v);
    const updated = _vehicles.find(v => v.id === Number(id));
    _history = [..._history, {
      id:            Date.now(),
      vehicleID:     Number(id),
      action:        'Updated',
      changedFields,
      timestamp:     new Date().toISOString(),
      snapshot:      { ...updated },
    }];
  },

  remove: (id) => { _vehicles = _vehicles.filter(v => v.id !== Number(id)); },

  /* Returns all history entries newest-first */
  getHistory: () => [..._history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
};
