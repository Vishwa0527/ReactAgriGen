/**
 * Module-level store for Job Card data.
 */
import { MOCK } from './mockData';

let _cards = MOCK.jobCards.map(c => ({ ...c }));

export const jobCardStore = {
  getAll:      () => [..._cards],
  getById:     (id) => _cards.find(c => c.id === Number(id)),
  getByTaskID: (taskID) => _cards.filter(c => c.maintenanceTaskID === Number(taskID)),

  add: (data) => {
    _cards = [..._cards, { id: Date.now(), ...data }];
  },
  update: (id, data) => {
    _cards = _cards.map(c => c.id === Number(id) ? { ...c, ...data } : c);
  },
  remove: (id) => { _cards = _cards.filter(c => c.id !== Number(id)); },
};
