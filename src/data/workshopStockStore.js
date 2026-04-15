/**
 * Module-level store for Workshop Inventory Stock.
 * Balance is maintained by itemIssueStore when items are issued to a workshop.
 */
import { MOCK } from './mockData';

let _stock = MOCK.workshopStock.map(s => ({ ...s }));

export const workshopStockStore = {
  getAll: () => [..._stock],

  getByWorkshop: (workshopID) =>
    _stock.filter(s => s.workshopID === Number(workshopID)),

  getBalance: (workshopID, skuID) =>
    _stock.find(s => s.workshopID === Number(workshopID) && s.skuID === Number(skuID))?.balance ?? 0,

  /** Add stock when items are issued to this workshop (FIFO add). */
  addStock: (workshopID, skuID, quantity, unitCost) => {
    const existing = _stock.find(s => s.workshopID === Number(workshopID) && s.skuID === Number(skuID));
    if (existing) {
      _stock = _stock.map(s =>
        s.workshopID === Number(workshopID) && s.skuID === Number(skuID)
          ? { ...s, balance: s.balance + Number(quantity), unitCost: Number(unitCost) }
          : s
      );
    } else {
      _stock = [..._stock, {
        id:         Date.now(),
        workshopID: Number(workshopID),
        skuID:      Number(skuID),
        balance:    Number(quantity),
        unitCost:   Number(unitCost),
      }];
    }
  },

  /** Deduct stock when issuing from workshop to vehicle (FIFO deduct). */
  deductStock: (workshopID, skuID, quantity) => {
    _stock = _stock.map(s =>
      s.workshopID === Number(workshopID) && s.skuID === Number(skuID)
        ? { ...s, balance: Math.max(0, s.balance - Number(quantity)) }
        : s
    );
  },

  /** Total stock value for a workshop. */
  totalValue: (workshopID) =>
    _stock
      .filter(s => s.workshopID === Number(workshopID))
      .reduce((sum, s) => sum + s.balance * s.unitCost, 0),
};
