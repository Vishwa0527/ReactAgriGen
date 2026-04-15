/**
 * Module-level store for Maintenance Record data.
 * On add(), applies workshop stock changes for Workshop-sourced items and returned parts.
 */
import { MOCK } from './mockData';
import { workshopStockStore } from './workshopStockStore';

let _records = MOCK.maintenanceRecords.map(r => ({ ...r, items: r.items ? r.items.map(i => ({ ...i })) : [] }));

export const maintenanceRecordStore = {
  getAll:       () => [..._records].sort((a, b) => b.date.localeCompare(a.date)),
  getById:      (id)     => _records.find(r => r.id === Number(id)),
  getByTaskID:  (taskID) => _records.filter(r => r.maintenanceTaskID === Number(taskID)),

  add: (data) => {
    _records = [..._records, { id: Date.now(), ...data }];
    /* Apply workshop stock changes */
    if (data.workshopID && data.items?.length) {
      data.items.forEach(item => {
        if (item.source === 'Workshop' && item.skuID && Number(item.quantity) > 0) {
          workshopStockStore.deductStock(data.workshopID, item.skuID, item.quantity);
        }
        if (item.hasRemovedItem && item.removedSkuID && Number(item.removedQuantity) > 0) {
          workshopStockStore.addStock(data.workshopID, item.removedSkuID, item.removedQuantity, Number(item.removedUnitCost) || 0);
        }
      });
    }
  },
  update: (id, data) => {
    _records = _records.map(r => r.id === Number(id) ? { ...r, ...data } : r);
  },
  remove: (id) => { _records = _records.filter(r => r.id !== Number(id)); },
};
