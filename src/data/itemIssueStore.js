/**
 * Module-level store for Item Issue data.
 * Manages issues of inventory items to Workshops or Vehicles.
 * When type='Workshop', also updates workshopStockStore.
 */
import { MOCK } from './mockData';
import { workshopStockStore } from './workshopStockStore';

let _issues = MOCK.itemIssues.map(r => ({
  ...r,
  items: r.items.map(i => ({ ...i })),
}));

function nextRefCode() {
  const year = new Date().getFullYear();
  const prefix = `II-${year}-`;
  const max = _issues.reduce((m, r) => {
    if (!r.refCode?.startsWith(prefix)) return m;
    const n = parseInt(r.refCode.replace(prefix, '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function totalValue(items) {
  return items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unitCost) || 0), 0);
}

export const itemIssueStore = {
  getAll:  () => [..._issues].sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
  getById: (id) => _issues.find(r => r.id === Number(id)),
  nextRefCode,
  isRefCodeUnique: (code, excludeID = null) =>
    !_issues.some(r => r.refCode === code && r.id !== excludeID),

  add: (data) => {
    const record = { id: Date.now(), ...data };
    _issues = [..._issues, record];
    /* Update workshop stock when issuing to a workshop */
    if (data.issueType === 'Workshop' && data.targetID) {
      data.items.forEach(item => {
        if (item.skuID && item.quantity > 0) {
          workshopStockStore.addStock(Number(data.targetID), Number(item.skuID), Number(item.quantity), Number(item.unitCost));
        }
      });
    }
  },

  update: (id, data) => {
    _issues = _issues.map(r => r.id === Number(id) ? { ...r, ...data } : r);
  },

  remove: (id) => { _issues = _issues.filter(r => r.id !== Number(id)); },

  totalValue,
};
