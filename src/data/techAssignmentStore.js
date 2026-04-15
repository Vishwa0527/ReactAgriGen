/**
 * Module-level store for Technician Assignment (Employee → TechCategory) data.
 */
import { MOCK } from './mockData';

let _assignments = MOCK.techAssignments.map(a => ({ notes: '', ...a }));

export const techAssignmentStore = {
  getAll:  ()    => [..._assignments],
  getById: (id)  => _assignments.find(a => a.id === Number(id)),

  /* Returns true if the employee is already assigned (excludes current record in edit) */
  isEmployeeAssigned: (employeeID, excludeID = null) =>
    _assignments.some(a => a.employeeID === Number(employeeID) && a.id !== excludeID),

  add: (data) => {
    _assignments = [..._assignments, { id: Date.now(), ...data }];
  },
  update: (id, data) => {
    _assignments = _assignments.map(a => a.id === Number(id) ? { ...a, ...data } : a);
  },
  remove: (id) => { _assignments = _assignments.filter(a => a.id !== Number(id)); },
};
