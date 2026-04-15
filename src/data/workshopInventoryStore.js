/**
 * Module-level store for Workshop Inventory (replaces WorkshopStock).
 * Header: WorkshopInventory — per-SKU per-workshop with reorder/min/max levels.
 * Detail: WorkshopInventoryDetail — FIFO batch tracking per ItemIssue.
 */
import { MOCK } from './mockData';

let _inventory = MOCK.workshopInventory.map(r => ({ ...r }));
let _details   = MOCK.workshopInventoryDetail.map(r => ({ ...r }));

function nextId(arr) {
  return arr.length ? Math.max(...arr.map(r => r.id)) + 1 : 1;
}

export const workshopInventoryStore = {
  /* ── Header (WorkshopInventory) ── */
  getAll:          ()   => [..._inventory],
  getById:         (id) => _inventory.find(r => r.id === Number(id)),
  getByWorkshop:   (workshopID) => _inventory.filter(r => r.workshopID === Number(workshopID)),
  getBySkuAndWs:   (workshopID, skuID) =>
    _inventory.find(r => r.workshopID === Number(workshopID) && r.skuID === Number(skuID)),

  getBalance: (workshopID, skuID) =>
    _inventory.find(r => r.workshopID === Number(workshopID) && r.skuID === Number(skuID))?.availableBalance ?? 0,

  add: (data) => {
    const id = nextId(_inventory);
    _inventory = [..._inventory, { id, ...data }];
    return id;
  },
  update: (id, data) => {
    _inventory = _inventory.map(r => r.id === Number(id) ? { ...r, ...data } : r);
  },
  remove: (id) => {
    _inventory = _inventory.filter(r => r.id !== Number(id));
    // Cascade remove detail rows
    _details = _details.filter(d => d.workshopInventoryID !== Number(id));
  },

  /** Add stock when items are issued to this workshop. */
  addStock: (workshopID, skuID, quantity, unitCost, itemIssueID, itemIssueReference, warehouseSKUMappingID, groupID, estateID) => {
    const existing = _inventory.find(r => r.workshopID === Number(workshopID) && r.skuID === Number(skuID));
    if (existing) {
      _inventory = _inventory.map(r =>
        r.workshopID === Number(workshopID) && r.skuID === Number(skuID)
          ? { ...r, availableBalance: r.availableBalance + Number(quantity), unitCost: Number(unitCost) }
          : r
      );
      // Add FIFO batch detail
      _details = [..._details, {
        id: nextId(_details),
        workshopInventoryID: existing.id,
        workshopID: Number(workshopID),
        skuID: Number(skuID),
        warehouseSKUMappingID: Number(warehouseSKUMappingID) || null,
        itemIssueID: Number(itemIssueID) || null,
        itemIssueReference: itemIssueReference || null,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        groupID: Number(groupID) || null,
        estateID: Number(estateID) || null,
      }];
    } else {
      const headerId = nextId(_inventory);
      _inventory = [..._inventory, {
        id: headerId,
        workshopID: Number(workshopID),
        skuID: Number(skuID),
        measuringUnitID: 1,
        warehouseSKUMappingID: Number(warehouseSKUMappingID) || null,
        reorderLevel: 0,
        availableBalance: Number(quantity),
        minLevel: 0,
        maxLevel: 0,
        unitCost: Number(unitCost),
        groupID: Number(groupID) || null,
        estateID: Number(estateID) || null,
      }];
      _details = [..._details, {
        id: nextId(_details),
        workshopInventoryID: headerId,
        workshopID: Number(workshopID),
        skuID: Number(skuID),
        warehouseSKUMappingID: Number(warehouseSKUMappingID) || null,
        itemIssueID: Number(itemIssueID) || null,
        itemIssueReference: itemIssueReference || null,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        groupID: Number(groupID) || null,
        estateID: Number(estateID) || null,
      }];
    }
  },

  /** Deduct stock (FIFO deduction from header balance). */
  deductStock: (workshopID, skuID, quantity) => {
    _inventory = _inventory.map(r =>
      r.workshopID === Number(workshopID) && r.skuID === Number(skuID)
        ? { ...r, availableBalance: Math.max(0, r.availableBalance - Number(quantity)) }
        : r
    );
  },

  /** Total stock value for a workshop. */
  totalValue: (workshopID) =>
    _inventory
      .filter(r => r.workshopID === Number(workshopID))
      .reduce((sum, r) => sum + r.availableBalance * r.unitCost, 0),

  /* ── Detail (WorkshopInventoryDetail / FIFO batches) ── */
  getAllDetails:    ()   => [..._details],
  getDetailsByInv: (workshopInventoryID) => _details.filter(d => d.workshopInventoryID === Number(workshopInventoryID)),
  getDetailsByWs:  (workshopID) => _details.filter(d => d.workshopID === Number(workshopID)),
};
