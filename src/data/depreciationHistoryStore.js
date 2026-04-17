/**
 * Module-level store for Depreciation History (period postings).
 * Each row represents a quarterly/monthly depreciation posting to the ledger.
 * ID prefix: 'deph'
 */
import { MOCK } from './mockData';

const GL_DEFAULTS = {
  GLApprovalStatus: 'Draft',
  GLApprovedBy:     null,
  GLApprovedDate:   null,
  GLRejectedBy:     null,
  GLRejectedDate:   null,
  GLRejectionNote:  null,
  GLPostingRef:     null,
  IsPostedToGL:     false,
  BatchReference:   null,
};

let _history = MOCK.depreciationHistory.map(h => ({ ...GL_DEFAULTS, ...h }));

function nextId() {
  return _history.length ? Math.max(..._history.map(h => h.id)) + 1 : 1;
}

export const depreciationHistoryStore = {
  getAll:             ()   => [..._history],
  getById:            (id) => _history.find(h => h.id === Number(id)),
  getByDepreciationId:(depID) =>
    _history.filter(h => h.depreciationID === Number(depID))
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
  getByAssetId:       (assetID) =>
    _history.filter(h => h.fixedAssetID === Number(assetID))
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),

  /** Total depreciation posted for an asset. */
  totalPosted: (assetID) =>
    _history.filter(h => h.fixedAssetID === Number(assetID))
            .reduce((sum, h) => sum + (h.value || 0), 0),

  /** Total depreciation posted for a specific schedule. */
  totalPostedForSchedule: (depID) =>
    _history.filter(h => h.depreciationID === Number(depID))
            .reduce((sum, h) => sum + (h.value || 0), 0),

  /**
   * Post a depreciation entry for a period.
   * @param {number} depreciationID — FK to Depreciation schedule
   * @param {number} fixedAssetID — FK to FixedAsset
   * @param {string} date — period end date (e.g. '2024-03-31')
   * @param {number} value — amount to post
   * @param {string} ledgerTransactionRef — ERP ledger reference
   * @param {number} groupID
   * @param {number} estateID
   */
  post: (depreciationID, fixedAssetID, date, value, ledgerTransactionRef, groupID, estateID) => {
    const entry = {
      ...GL_DEFAULTS,
      id: nextId(),
      depreciationID: Number(depreciationID),
      fixedAssetID:   Number(fixedAssetID),
      date,
      value:          parseFloat(value) || 0,
      ledgerTransactionRef: ledgerTransactionRef || null,
      groupID:        Number(groupID) || null,
      estateID:       Number(estateID) || null,
    };
    _history = [..._history, entry];
    return entry;
  },

  update: (id, data) => {
    _history = _history.map(h => h.id === Number(id) ? { ...h, ...data } : h);
  },

  /** Update GL fields on a set of history entries in one call. */
  batchUpdate: (ids, data) => {
    const idSet = new Set(ids.map(Number));
    _history = _history.map(h => idSet.has(h.id) ? { ...h, ...data } : h);
  },

  /** Remove a set of history entries (used to clean up rejected batches). */
  batchRemove: (ids) => {
    const idSet = new Set(ids.map(Number));
    _history = _history.filter(h => !idSet.has(h.id));
  },
};
