/**
 * Module-level store for Maintenance Task data.
 */
import { MOCK } from './mockData';

let _tasks = MOCK.maintenanceTasks.map(t => ({ ...t, notes: t.notes ?? '' }));

function nextRefCode() {
  const max = _tasks.reduce((m, t) => {
    const n = parseInt(t.refCode?.replace('MT-', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `MT-${String(max + 1).padStart(3, '0')}`;
}

export const maintenanceTaskStore = {
  getAll:  () => [..._tasks].sort((a, b) => b.date.localeCompare(a.date)),
  getById: (id) => _tasks.find(t => t.id === Number(id)),
  nextRefCode,
  isRefCodeUnique: (code, excludeID = null) =>
    !_tasks.some(t => t.refCode === code && t.id !== excludeID),

  add: (data) => {
    _tasks = [..._tasks, { id: Date.now(), ...data }];
  },
  update: (id, data) => {
    _tasks = _tasks.map(t => t.id === Number(id) ? { ...t, ...data } : t);
  },
  remove: (id) => { _tasks = _tasks.filter(t => t.id !== Number(id)); },
};
