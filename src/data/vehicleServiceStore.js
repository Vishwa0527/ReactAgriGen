/**
 * Module-level store for Vehicle Service data.
 * On add(), applies workshop stock changes for Workshop-sourced items and returned parts.
 */
import { MOCK } from './mockData';
import { workshopStockStore } from './workshopStockStore';

const GL_DEFAULTS = {
  GLApprovalStatus: 'Draft',
  GLApprovedBy:     null,
  GLApprovedDate:   null,
  GLRejectedBy:     null,
  GLRejectedDate:   null,
  GLRejectionNote:  null,
  GLPostingRef:     null,
  IsPostedToGL:     false,
};

let _services = MOCK.vehicleService.map(s => ({ ...GL_DEFAULTS, ...s, notes: s.notes ?? '' }));

export const vehicleServiceStore = {
  getAll:  () => [..._services].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)),
  getById: (id) => _services.find(s => s.id === Number(id)),

  /** Returns the most recent service record for a vehicle (for odo/date hints). */
  getLastByVehicle: (vehicleID) => {
    const sorted = _services
      .filter(s => s.vehicleID === Number(vehicleID))
      .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
    return sorted[0] ?? null;
  },

  add: (data) => {
    _services = [..._services, { id: Date.now(), ...data }];
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
    _services = _services.map(s => s.id === Number(id) ? { ...s, ...data } : s);
  },
  remove: (id) => { _services = _services.filter(s => s.id !== Number(id)); },
};
