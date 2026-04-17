/**
 * GL Mapping store — GLMappingHeader and GLAccountMapping tables.
 *
 * Defines which Dr/Cr accounts to use for each transaction type.
 * Admin-configures these once; the GL Engine reads them at posting time.
 *
 * resolveAccounts(transactionTypeCode, fixedAssetTypeID, fixedAssetCategoryID)
 * → returns matching mapping lines using priority:
 *     1. typeCode + typeID + catID  (most specific — category-level override)
 *     2. typeCode + typeID + catID=null  (type-level fallback)
 *     3. typeCode + typeID=null + catID=null  (global fallback)
 *     4. null — no mapping configured → block posting
 *
 * lineRole controls how the GL Engine assigns amounts to each line:
 *   'FULL_AMOUNT' → use the single `amount` parameter (for all 2-line entries)
 *   'ACCUM_DEP'   → use amounts.accumDep (disposal journals)
 *   'PROCEEDS'    → use amounts.proceeds (disposal journals)
 *   'ASSET_COST'  → use amounts.assetCost (disposal journals)
 *   'GAIN_AMOUNT' → use amounts.gainAmount (disposal gain line)
 *   'LOSS_AMOUNT' → use amounts.lossAmount (disposal loss/writeoff line)
 */

let _headers = [
  { id: 1, moduleCode: 'FA',    transactionTypeCode: 'FA_CAPITALIZATION',    transactionTypeName: 'Fixed Asset Capitalization',   description: 'New asset registered in the Fixed Asset Register',     isActive: true },
  { id: 2, moduleCode: 'FA',    transactionTypeCode: 'FA_DEPRECIATION',      transactionTypeName: 'Depreciation Charge',           description: 'Period depreciation posted for an asset',             isActive: true },
  { id: 3, moduleCode: 'FA',    transactionTypeCode: 'FA_ASSET_MAINT',       transactionTypeName: 'Asset Maintenance Cost',        description: 'Maintenance record completed for a fixed asset',      isActive: true },
  { id: 4, moduleCode: 'FLEET', transactionTypeCode: 'FLEET_MAINT_RECORD',   transactionTypeName: 'Fleet Maintenance Record',      description: 'Maintenance record saved for a fleet vehicle/asset',  isActive: true },
  { id: 5, moduleCode: 'FLEET', transactionTypeCode: 'FLEET_VEHICLE_SVC',    transactionTypeName: 'Fleet Vehicle Service',         description: 'Vehicle service record saved',                        isActive: true },
  { id: 6, moduleCode: 'FA',    transactionTypeCode: 'FA_DISPOSAL_GAIN',     transactionTypeName: 'Asset Disposal — Gain',         description: 'Disposal where proceeds exceed net book value',       isActive: true },
  { id: 7, moduleCode: 'FA',    transactionTypeCode: 'FA_DISPOSAL_LOSS',     transactionTypeName: 'Asset Disposal — Loss',         description: 'Disposal where proceeds are below net book value',    isActive: true },
  { id: 8, moduleCode: 'FA',    transactionTypeCode: 'FA_DISPOSAL_WRITEOFF', transactionTypeName: 'Asset Write-off / Scrap',       description: 'Asset written off with zero or negligible proceeds',  isActive: true },
];

let _mappings = [
  /* ════════════════════════════════════════════════════════════════
   * FA_CAPITALIZATION — Dr Asset Cost, Cr Asset Creditors
   * ════════════════════════════════════════════════════════════════ */
  // Motor Vehicle (TypeID = 1)
  { id:  1, glMappingHeaderID: 1, lineDescription: 'Dr: Motor Vehicles — Cost',          drCr: 'DR', ledgerAccountID:  1, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id:  2, glMappingHeaderID: 1, lineDescription: 'Cr: Asset Creditors / Payables',     drCr: 'CR', ledgerAccountID: 10, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },
  // Agricultural Machine (TypeID = 2)
  { id:  3, glMappingHeaderID: 1, lineDescription: 'Dr: Agricultural Machinery — Cost',  drCr: 'DR', ledgerAccountID:  2, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id:  4, glMappingHeaderID: 1, lineDescription: 'Cr: Asset Creditors / Payables',     drCr: 'CR', ledgerAccountID: 10, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },
  // Heavy Equipment (TypeID = 3)
  { id:  5, glMappingHeaderID: 1, lineDescription: 'Dr: Heavy Equipment — Cost',         drCr: 'DR', ledgerAccountID:  3, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id:  6, glMappingHeaderID: 1, lineDescription: 'Cr: Asset Creditors / Payables',     drCr: 'CR', ledgerAccountID: 10, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },

  /* ════════════════════════════════════════════════════════════════
   * FA_DEPRECIATION — Dr Dep. Expense, Cr Accum. Depreciation
   * Category-level mappings take priority over type-level fallbacks.
   * ════════════════════════════════════════════════════════════════ */
  // Motor Vehicle (TypeID = 1) — type-level only, no category override
  { id:  7, glMappingHeaderID: 2, lineDescription: 'Dr: Dep. Exp — Motor Vehicles',      drCr: 'DR', ledgerAccountID: 13, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id:  8, glMappingHeaderID: 2, lineDescription: 'Cr: Accum. Dep. — Motor Vehicles',   drCr: 'CR', ledgerAccountID:  4, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },
  // Agri Machine — Tractors (TypeID = 2, CatID = 2) — category override
  { id:  9, glMappingHeaderID: 2, lineDescription: 'Dr: Dep. Exp — Tractors',            drCr: 'DR', ledgerAccountID: 15, fixedAssetTypeID: 2, fixedAssetCategoryID: 2,    lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id: 10, glMappingHeaderID: 2, lineDescription: 'Cr: Accum. Dep. — Tractors',         drCr: 'CR', ledgerAccountID:  5, fixedAssetTypeID: 2, fixedAssetCategoryID: 2,    lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },
  // Agri Machine — Harvesters (TypeID = 2, CatID = 3) — category override
  { id: 11, glMappingHeaderID: 2, lineDescription: 'Dr: Dep. Exp — Harvesters',          drCr: 'DR', ledgerAccountID: 16, fixedAssetTypeID: 2, fixedAssetCategoryID: 3,    lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id: 12, glMappingHeaderID: 2, lineDescription: 'Cr: Accum. Dep. — Harvesters',       drCr: 'CR', ledgerAccountID:  6, fixedAssetTypeID: 2, fixedAssetCategoryID: 3,    lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },
  // Agri Machine — type fallback (catID not mapped above)
  { id: 13, glMappingHeaderID: 2, lineDescription: 'Dr: Dep. Exp — Agri. Machinery',     drCr: 'DR', ledgerAccountID: 14, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id: 14, glMappingHeaderID: 2, lineDescription: 'Cr: Accum. Dep. — Agri. Machinery',  drCr: 'CR', ledgerAccountID:  5, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },
  // Heavy Equipment (TypeID = 3)
  { id: 15, glMappingHeaderID: 2, lineDescription: 'Dr: Dep. Exp — Heavy Equipment',     drCr: 'DR', ledgerAccountID: 17, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id: 16, glMappingHeaderID: 2, lineDescription: 'Cr: Accum. Dep. — Heavy Equipment',  drCr: 'CR', ledgerAccountID:  7, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },

  /* ════════════════════════════════════════════════════════════════
   * FA_ASSET_MAINT — global mapping (all asset types)
   * ════════════════════════════════════════════════════════════════ */
  { id: 17, glMappingHeaderID: 3, lineDescription: 'Dr: Repairs & Maint. Exp — Fixed Assets', drCr: 'DR', ledgerAccountID: 20, fixedAssetTypeID: null, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id: 18, glMappingHeaderID: 3, lineDescription: 'Cr: Workshop Payables',                   drCr: 'CR', ledgerAccountID: 11, fixedAssetTypeID: null, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },

  /* ════════════════════════════════════════════════════════════════
   * FLEET_MAINT_RECORD — global mapping
   * ════════════════════════════════════════════════════════════════ */
  { id: 19, glMappingHeaderID: 4, lineDescription: 'Dr: Fleet Maintenance Expense',            drCr: 'DR', ledgerAccountID: 18, fixedAssetTypeID: null, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id: 20, glMappingHeaderID: 4, lineDescription: 'Cr: Workshop Payables',                   drCr: 'CR', ledgerAccountID: 11, fixedAssetTypeID: null, fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },

  /* ════════════════════════════════════════════════════════════════
   * FLEET_VEHICLE_SVC — Motor Vehicle only (TypeID = 1 always)
   * ════════════════════════════════════════════════════════════════ */
  { id: 21, glMappingHeaderID: 5, lineDescription: 'Dr: Vehicle Service Expense',              drCr: 'DR', ledgerAccountID: 19, fixedAssetTypeID: 1,    fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 1, isActive: true },
  { id: 22, glMappingHeaderID: 5, lineDescription: 'Cr: Workshop Payables',                   drCr: 'CR', ledgerAccountID: 11, fixedAssetTypeID: 1,    fixedAssetCategoryID: null, lineRole: 'FULL_AMOUNT', sortOrder: 2, isActive: true },

  /* ════════════════════════════════════════════════════════════════
   * FA_DISPOSAL_GAIN (4-line journal — amounts vary per line)
   * Dr: Accum.Dep + Proceeds  |  Cr: Asset Cost + Gain
   * ════════════════════════════════════════════════════════════════ */
  // Motor Vehicle (TypeID = 1)
  { id: 23, glMappingHeaderID: 6, lineDescription: 'Dr: Accum. Dep. — Motor Vehicles',         drCr: 'DR', ledgerAccountID:  4, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 24, glMappingHeaderID: 6, lineDescription: 'Dr: Disposal Proceeds Receivable',         drCr: 'DR', ledgerAccountID:  9, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'PROCEEDS',    sortOrder: 2, isActive: true },
  { id: 25, glMappingHeaderID: 6, lineDescription: 'Cr: Motor Vehicles — Cost',                drCr: 'CR', ledgerAccountID:  1, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 3, isActive: true },
  { id: 26, glMappingHeaderID: 6, lineDescription: 'Cr: Gain on Disposal of Fixed Assets',     drCr: 'CR', ledgerAccountID: 12, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'GAIN_AMOUNT', sortOrder: 4, isActive: true },
  // Agricultural Machine (TypeID = 2)
  { id: 27, glMappingHeaderID: 6, lineDescription: 'Dr: Accum. Dep. — Agri. Machinery',        drCr: 'DR', ledgerAccountID:  5, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 28, glMappingHeaderID: 6, lineDescription: 'Dr: Disposal Proceeds Receivable',         drCr: 'DR', ledgerAccountID:  9, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'PROCEEDS',    sortOrder: 2, isActive: true },
  { id: 29, glMappingHeaderID: 6, lineDescription: 'Cr: Agricultural Machinery — Cost',        drCr: 'CR', ledgerAccountID:  2, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 3, isActive: true },
  { id: 30, glMappingHeaderID: 6, lineDescription: 'Cr: Gain on Disposal of Fixed Assets',     drCr: 'CR', ledgerAccountID: 12, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'GAIN_AMOUNT', sortOrder: 4, isActive: true },
  // Heavy Equipment (TypeID = 3)
  { id: 31, glMappingHeaderID: 6, lineDescription: 'Dr: Accum. Dep. — Heavy Equipment',        drCr: 'DR', ledgerAccountID:  7, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 32, glMappingHeaderID: 6, lineDescription: 'Dr: Disposal Proceeds Receivable',         drCr: 'DR', ledgerAccountID:  9, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'PROCEEDS',    sortOrder: 2, isActive: true },
  { id: 33, glMappingHeaderID: 6, lineDescription: 'Cr: Heavy Equipment — Cost',               drCr: 'CR', ledgerAccountID:  3, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 3, isActive: true },
  { id: 34, glMappingHeaderID: 6, lineDescription: 'Cr: Gain on Disposal of Fixed Assets',     drCr: 'CR', ledgerAccountID: 12, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'GAIN_AMOUNT', sortOrder: 4, isActive: true },

  /* ════════════════════════════════════════════════════════════════
   * FA_DISPOSAL_LOSS (4-line journal)
   * Dr: Accum.Dep + Proceeds + Loss  |  Cr: Asset Cost
   * ════════════════════════════════════════════════════════════════ */
  // Motor Vehicle (TypeID = 1)
  { id: 35, glMappingHeaderID: 7, lineDescription: 'Dr: Accum. Dep. — Motor Vehicles',         drCr: 'DR', ledgerAccountID:  4, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 36, glMappingHeaderID: 7, lineDescription: 'Dr: Disposal Proceeds Receivable',         drCr: 'DR', ledgerAccountID:  9, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'PROCEEDS',    sortOrder: 2, isActive: true },
  { id: 37, glMappingHeaderID: 7, lineDescription: 'Dr: Loss on Disposal of Fixed Assets',     drCr: 'DR', ledgerAccountID: 21, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'LOSS_AMOUNT', sortOrder: 3, isActive: true },
  { id: 38, glMappingHeaderID: 7, lineDescription: 'Cr: Motor Vehicles — Cost',                drCr: 'CR', ledgerAccountID:  1, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 4, isActive: true },
  // Agricultural Machine (TypeID = 2)
  { id: 39, glMappingHeaderID: 7, lineDescription: 'Dr: Accum. Dep. — Agri. Machinery',        drCr: 'DR', ledgerAccountID:  5, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 40, glMappingHeaderID: 7, lineDescription: 'Dr: Disposal Proceeds Receivable',         drCr: 'DR', ledgerAccountID:  9, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'PROCEEDS',    sortOrder: 2, isActive: true },
  { id: 41, glMappingHeaderID: 7, lineDescription: 'Dr: Loss on Disposal of Fixed Assets',     drCr: 'DR', ledgerAccountID: 21, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'LOSS_AMOUNT', sortOrder: 3, isActive: true },
  { id: 42, glMappingHeaderID: 7, lineDescription: 'Cr: Agricultural Machinery — Cost',        drCr: 'CR', ledgerAccountID:  2, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 4, isActive: true },
  // Heavy Equipment (TypeID = 3)
  { id: 43, glMappingHeaderID: 7, lineDescription: 'Dr: Accum. Dep. — Heavy Equipment',        drCr: 'DR', ledgerAccountID:  7, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 44, glMappingHeaderID: 7, lineDescription: 'Dr: Disposal Proceeds Receivable',         drCr: 'DR', ledgerAccountID:  9, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'PROCEEDS',    sortOrder: 2, isActive: true },
  { id: 45, glMappingHeaderID: 7, lineDescription: 'Dr: Loss on Disposal of Fixed Assets',     drCr: 'DR', ledgerAccountID: 21, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'LOSS_AMOUNT', sortOrder: 3, isActive: true },
  { id: 46, glMappingHeaderID: 7, lineDescription: 'Cr: Heavy Equipment — Cost',               drCr: 'CR', ledgerAccountID:  3, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 4, isActive: true },

  /* ════════════════════════════════════════════════════════════════
   * FA_DISPOSAL_WRITEOFF (3-line journal — zero proceeds)
   * Dr: Accum.Dep + Loss  |  Cr: Asset Cost
   * ════════════════════════════════════════════════════════════════ */
  // Motor Vehicle (TypeID = 1)
  { id: 47, glMappingHeaderID: 8, lineDescription: 'Dr: Accum. Dep. — Motor Vehicles',         drCr: 'DR', ledgerAccountID:  4, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 48, glMappingHeaderID: 8, lineDescription: 'Dr: Loss on Write-off / Scrap',            drCr: 'DR', ledgerAccountID: 22, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'LOSS_AMOUNT', sortOrder: 2, isActive: true },
  { id: 49, glMappingHeaderID: 8, lineDescription: 'Cr: Motor Vehicles — Cost',                drCr: 'CR', ledgerAccountID:  1, fixedAssetTypeID: 1, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 3, isActive: true },
  // Agricultural Machine (TypeID = 2)
  { id: 50, glMappingHeaderID: 8, lineDescription: 'Dr: Accum. Dep. — Agri. Machinery',        drCr: 'DR', ledgerAccountID:  5, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 51, glMappingHeaderID: 8, lineDescription: 'Dr: Loss on Write-off / Scrap',            drCr: 'DR', ledgerAccountID: 22, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'LOSS_AMOUNT', sortOrder: 2, isActive: true },
  { id: 52, glMappingHeaderID: 8, lineDescription: 'Cr: Agricultural Machinery — Cost',        drCr: 'CR', ledgerAccountID:  2, fixedAssetTypeID: 2, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 3, isActive: true },
  // Heavy Equipment (TypeID = 3)
  { id: 53, glMappingHeaderID: 8, lineDescription: 'Dr: Accum. Dep. — Heavy Equipment',        drCr: 'DR', ledgerAccountID:  7, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'ACCUM_DEP',   sortOrder: 1, isActive: true },
  { id: 54, glMappingHeaderID: 8, lineDescription: 'Dr: Loss on Write-off / Scrap',            drCr: 'DR', ledgerAccountID: 22, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'LOSS_AMOUNT', sortOrder: 2, isActive: true },
  { id: 55, glMappingHeaderID: 8, lineDescription: 'Cr: Heavy Equipment — Cost',               drCr: 'CR', ledgerAccountID:  3, fixedAssetTypeID: 3, fixedAssetCategoryID: null, lineRole: 'ASSET_COST',  sortOrder: 3, isActive: true },
];

export const glMappingStore = {
  /* ── Read operations ────────────────────────────────────────────────── */
  getAllHeaders:       ()         => [..._headers],
  getHeaderByTypeCode:(typeCode) => _headers.find(h => h.transactionTypeCode === typeCode),
  getAllMappings:      ()         => [..._mappings],
  getMappingsByHeader:(headerID) => _mappings.filter(m => m.glMappingHeaderID === Number(headerID)),

  /**
   * Resolves the GL account mapping lines for a given transaction context.
   * Returns an array of mapping line objects, or null if no mapping is found.
   *
   * @param {string}  transactionTypeCode
   * @param {number|null} fixedAssetTypeID
   * @param {number|null} fixedAssetCategoryID
   * @returns {Array|null}
   */
  resolveAccounts(transactionTypeCode, fixedAssetTypeID = null, fixedAssetCategoryID = null) {
    const header = _headers.find(h => h.transactionTypeCode === transactionTypeCode && h.isActive);
    if (!header) return null;

    const lines = _mappings
      .filter(m => m.glMappingHeaderID === header.id && m.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const tid = fixedAssetTypeID ? Number(fixedAssetTypeID) : null;
    const cid = fixedAssetCategoryID ? Number(fixedAssetCategoryID) : null;

    // Priority 1: exact type + category match
    if (tid && cid) {
      const p1 = lines.filter(m => m.fixedAssetTypeID === tid && m.fixedAssetCategoryID === cid);
      if (p1.length > 0) return p1;
    }

    // Priority 2: type match, no category restriction
    if (tid) {
      const p2 = lines.filter(m => m.fixedAssetTypeID === tid && m.fixedAssetCategoryID === null);
      if (p2.length > 0) return p2;
    }

    // Priority 3: global mapping (no type, no category)
    const p3 = lines.filter(m => m.fixedAssetTypeID === null && m.fixedAssetCategoryID === null);
    if (p3.length > 0) return p3;

    return null; // no mapping configured — engine will block posting
  },

  /* ── Admin write operations ─────────────────────────────────────────── */
  addHeader: (data) => {
    const id = Math.max(..._headers.map(h => h.id), 0) + 1;
    _headers = [..._headers, { id, isActive: true, ...data }];
    return id;
  },

  addMappingLine: (data) => {
    const id = Math.max(..._mappings.map(m => m.id), 0) + 1;
    _mappings = [..._mappings, { id, isActive: true, ...data }];
    return id;
  },

  updateMappingLine: (id, data) => {
    _mappings = _mappings.map(m => m.id === Number(id) ? { ...m, ...data } : m);
  },

  deactivateMappingLine: (id) => {
    _mappings = _mappings.map(m => m.id === Number(id) ? { ...m, isActive: false } : m);
  },
};
