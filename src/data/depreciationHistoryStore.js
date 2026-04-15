/**
 * Module-level store for Depreciation History (period postings).
 * Each row represents a quarterly/monthly depreciation posting to the ledger.
 * ID prefix: 'deph'
 */
import { MOCK } from './mockData';

let _history = MOCK.depreciationHistory.map(h => ({ ...h }));

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
};
