/**
 * Module-level store for Daily Running records.
 * State persists across route transitions without Redux/Context.
 */
import { MOCK } from './mockData';

let _runs = MOCK.dailyRunning.map(r => ({ notes: '', ...r }));

/* Auto-generate next ref code: DR-YYYY-NNN */
function nextRefCode() {
  const year = new Date().getFullYear();
  const thisYear = _runs.filter(r => r.refCode?.startsWith(`DR-${year}-`));
  return `DR-${year}-${String(thisYear.length + 1).padStart(3, '0')}`;
}

/* Last recorded end-odometer for a vehicle (for start-odo hint) */
function getLastOdo(vehicleID) {
  const records = _runs
    .filter(r => r.vehicleID === Number(vehicleID) && r.endOdo != null)
    .sort((a, b) => new Date(b.startDateTime.replace(' ', 'T')) - new Date(a.startDateTime.replace(' ', 'T')));
  return records[0]?.endOdo ?? null;
}

export const dailyRunningStore = {
  getAll:       ()    => [..._runs].sort((a, b) =>
    new Date(b.startDateTime.replace(' ', 'T')) - new Date(a.startDateTime.replace(' ', 'T'))
  ),
  getById:      (id)  => _runs.find(r => r.id === Number(id)),
  nextRefCode,
  getLastOdo,

  add: (data) => {
    _runs = [..._runs, { id: Date.now(), ...data }];
  },

  update: (id, data) => {
    _runs = _runs.map(r => r.id === Number(id) ? { ...r, ...data } : r);
  },

  remove: (id) => { _runs = _runs.filter(r => r.id !== Number(id)); },
};
