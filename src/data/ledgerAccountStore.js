/**
 * Chart of Accounts store.
 * Holds the four-level account hierarchy:
 *   LedgerAccountType → ParentHeader → ChildHeader → LedgerAccount
 *
 * These are reference / configuration data. Read-only in normal operations;
 * admin-configurable through the Chart of Accounts setup screen.
 *
 * Account code convention:
 *   1xxx — Assets          (DR normal balance)
 *   2xxx — Liabilities     (CR normal balance)
 *   3xxx — Equity          (CR normal balance)
 *   4xxx — Revenue/Income  (CR normal balance)
 *   5xxx — Expenses        (DR normal balance)
 */

const _types = [
  { id: 1, typeCode: 'ASSET',     typeName: 'Assets',           normalBalance: 'DR' },
  { id: 2, typeCode: 'LIABILITY', typeName: 'Liabilities',      normalBalance: 'CR' },
  { id: 3, typeCode: 'EQUITY',    typeName: 'Equity',           normalBalance: 'CR' },
  { id: 4, typeCode: 'REVENUE',   typeName: 'Revenue / Income', normalBalance: 'CR' },
  { id: 5, typeCode: 'EXPENSE',   typeName: 'Expenses',         normalBalance: 'DR' },
];

const _parentHeaders = [
  { id: 1, ledgerAccountTypeID: 1, code: 'PH-1000', name: 'Non-Current Assets',  groupID: null },
  { id: 2, ledgerAccountTypeID: 1, code: 'PH-1100', name: 'Current Assets',       groupID: null },
  { id: 3, ledgerAccountTypeID: 2, code: 'PH-2100', name: 'Current Liabilities',  groupID: null },
  { id: 4, ledgerAccountTypeID: 4, code: 'PH-4000', name: 'Other Income',         groupID: null },
  { id: 5, ledgerAccountTypeID: 5, code: 'PH-5000', name: 'Operating Expenses',   groupID: null },
];

const _childHeaders = [
  { id: 1, parentHeaderID: 1, code: 'CH-1010', name: 'Property, Plant & Equipment — Cost' },
  { id: 2, parentHeaderID: 1, code: 'CH-1015', name: 'Accumulated Depreciation'            },
  { id: 3, parentHeaderID: 2, code: 'CH-1110', name: 'Cash & Bank'                         },
  { id: 4, parentHeaderID: 2, code: 'CH-1120', name: 'Trade & Other Receivables'            },
  { id: 5, parentHeaderID: 3, code: 'CH-2110', name: 'Trade Payables & Accruals'            },
  { id: 6, parentHeaderID: 4, code: 'CH-4010', name: 'Gain on Disposal of Assets'           },
  { id: 7, parentHeaderID: 5, code: 'CH-5010', name: 'Depreciation Expense'                 },
  { id: 8, parentHeaderID: 5, code: 'CH-5020', name: 'Maintenance & Service Expense'        },
  { id: 9, parentHeaderID: 5, code: 'CH-5030', name: 'Loss on Disposal of Assets'           },
];

const _accounts = [
  /* ── Property, Plant & Equipment — Cost ─────────────────────────────── */
  { id:  1, childHeaderID: 1, accountCode: '1010-001', accountName: 'Motor Vehicles — Cost',                    isActive: true, allowDirectPosting: true },
  { id:  2, childHeaderID: 1, accountCode: '1010-002', accountName: 'Agricultural Machinery — Cost',            isActive: true, allowDirectPosting: true },
  { id:  3, childHeaderID: 1, accountCode: '1010-003', accountName: 'Heavy Equipment — Cost',                   isActive: true, allowDirectPosting: true },

  /* ── Accumulated Depreciation (contra-asset) ─────────────────────────── */
  { id:  4, childHeaderID: 2, accountCode: '1015-001', accountName: 'Accum. Depreciation — Motor Vehicles',     isActive: true, allowDirectPosting: true },
  { id:  5, childHeaderID: 2, accountCode: '1015-002', accountName: 'Accum. Depreciation — Tractors',           isActive: true, allowDirectPosting: true },
  { id:  6, childHeaderID: 2, accountCode: '1015-003', accountName: 'Accum. Depreciation — Harvesters',         isActive: true, allowDirectPosting: true },
  { id:  7, childHeaderID: 2, accountCode: '1015-004', accountName: 'Accum. Depreciation — Heavy Equipment',    isActive: true, allowDirectPosting: true },

  /* ── Cash & Bank ─────────────────────────────────────────────────────── */
  { id:  8, childHeaderID: 3, accountCode: '1110-001', accountName: 'Cash at Bank — Operations',                isActive: true, allowDirectPosting: true },

  /* ── Receivables ─────────────────────────────────────────────────────── */
  { id:  9, childHeaderID: 4, accountCode: '1120-001', accountName: 'Disposal Proceeds Receivable',             isActive: true, allowDirectPosting: true },

  /* ── Trade Payables & Accruals ───────────────────────────────────────── */
  { id: 10, childHeaderID: 5, accountCode: '2110-001', accountName: 'Asset Creditors / Payables',               isActive: true, allowDirectPosting: true },
  { id: 11, childHeaderID: 5, accountCode: '2110-002', accountName: 'Workshop Payables',                        isActive: true, allowDirectPosting: true },

  /* ── Gain on Disposal ────────────────────────────────────────────────── */
  { id: 12, childHeaderID: 6, accountCode: '4010-001', accountName: 'Gain on Disposal of Fixed Assets',         isActive: true, allowDirectPosting: true },

  /* ── Depreciation Expense ────────────────────────────────────────────── */
  { id: 13, childHeaderID: 7, accountCode: '5010-001', accountName: 'Depreciation Expense — Motor Vehicles',    isActive: true, allowDirectPosting: true },
  { id: 14, childHeaderID: 7, accountCode: '5010-002', accountName: 'Depreciation Expense — Agri. Machinery',   isActive: true, allowDirectPosting: true },
  { id: 15, childHeaderID: 7, accountCode: '5010-003', accountName: 'Depreciation Expense — Tractors',          isActive: true, allowDirectPosting: true },
  { id: 16, childHeaderID: 7, accountCode: '5010-004', accountName: 'Depreciation Expense — Harvesters',        isActive: true, allowDirectPosting: true },
  { id: 17, childHeaderID: 7, accountCode: '5010-005', accountName: 'Depreciation Expense — Heavy Equipment',   isActive: true, allowDirectPosting: true },

  /* ── Maintenance & Service Expense ──────────────────────────────────── */
  { id: 18, childHeaderID: 8, accountCode: '5020-001', accountName: 'Fleet Maintenance Expense',                isActive: true, allowDirectPosting: true },
  { id: 19, childHeaderID: 8, accountCode: '5020-002', accountName: 'Vehicle Service Expense',                  isActive: true, allowDirectPosting: true },
  { id: 20, childHeaderID: 8, accountCode: '5020-003', accountName: 'Repairs & Maintenance Exp — Fixed Assets', isActive: true, allowDirectPosting: true },

  /* ── Loss on Disposal ────────────────────────────────────────────────── */
  { id: 21, childHeaderID: 9, accountCode: '5030-001', accountName: 'Loss on Disposal of Fixed Assets',         isActive: true, allowDirectPosting: true },
  { id: 22, childHeaderID: 9, accountCode: '5030-002', accountName: 'Loss on Write-off / Scrap',                isActive: true, allowDirectPosting: true },
];

export const ledgerAccountStore = {
  /* ── Account Types ──────────────────────────────────────────────────── */
  getAllTypes:          ()       => [..._types],
  getTypeById:         (id)     => _types.find(t => t.id === Number(id)),
  getTypeByCode:       (code)   => _types.find(t => t.typeCode === code),

  /* ── Parent Headers ─────────────────────────────────────────────────── */
  getAllParentHeaders:  ()       => [..._parentHeaders],
  getParentsByType:    (typeID) => _parentHeaders.filter(p => p.ledgerAccountTypeID === Number(typeID)),

  /* ── Child Headers ──────────────────────────────────────────────────── */
  getAllChildHeaders:   ()          => [..._childHeaders],
  getChildrenByParent: (parentID)  => _childHeaders.filter(c => c.parentHeaderID === Number(parentID)),

  /* ── Ledger Accounts (postable) ─────────────────────────────────────── */
  getAll:              ()       => [..._accounts],
  getById:             (id)     => _accounts.find(a => a.id === Number(id)),
  getByCode:           (code)   => _accounts.find(a => a.accountCode === code),
  getActive:           ()       => _accounts.filter(a => a.isActive && a.allowDirectPosting),
  getByChildHeader:    (childID)=> _accounts.filter(a => a.childHeaderID === Number(childID)),
};
