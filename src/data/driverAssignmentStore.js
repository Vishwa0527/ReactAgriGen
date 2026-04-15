/**
 * Module-level store for Driver Assignment data.
 * Shared between DriverAssignments (listing/modal).
 * State persists across route transitions without Redux/Context.
 */
import { MOCK } from './mockData';

let _assignments = MOCK.driverAssignments.map(a => ({ notes: '', ...a }));

export const driverAssignmentStore = {
  getAll:  ()    => [..._assignments],
  getById: (id)  => _assignments.find(a => a.id === Number(id)),

  add: (data) => {
    _assignments = [..._assignments, { id: Date.now(), ...data }];
  },

  update: (id, data) => {
    _assignments = _assignments.map(a => a.id === Number(id) ? { ...a, ...data } : a);
  },

  remove: (id) => { _assignments = _assignments.filter(a => a.id !== Number(id)); },

  /* Convenience — used for conflict-checking */
  getActiveByVehicle: (vehicleID) =>
    _assignments.find(a => a.vehicleID === Number(vehicleID) && !a.endDate),
  getActiveByDriver: (driverID) =>
    _assignments.find(a => a.driverID === Number(driverID) && !a.endDate),
};
