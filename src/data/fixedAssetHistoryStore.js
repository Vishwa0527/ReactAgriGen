/**
 * Module-level store for Fixed Asset History (immutable snapshots).
 * Read-only for views — snapshots are created by system events.
 * ID prefix: 'fahv'
 */
import { MOCK } from './mockData';

let _history = MOCK.fixedAssetHistory.map(h => ({ ...h }));

function nextId() {
  return _history.length ? Math.max(..._history.map(h => h.id)) + 1 : 1;
}

export const fixedAssetHistoryStore = {
  getAll:        ()   => [..._history],
  getById:       (id) => _history.find(h => h.id === Number(id)),
  getByAssetId:  (assetID) =>
    _history
      .filter(h => h.fixedAssetID === Number(assetID))
      .sort((a, b) => (b.changeDate ?? '').localeCompare(a.changeDate ?? '')),

  /**
   * Create an immutable snapshot of a FixedAsset at a change event.
   * @param {object} asset — full asset record to snapshot
   * @param {string} changeType — 'Initial Registration' | 'Revaluation' | 'Maintenance Impact' | 'Disposal' | ...
   * @param {object} extras — { newUsefulLifeYears, newResidualValue, presentValue, assetMaintenanceID, warrantyClaimDate, ... }
   */
  addSnapshot: (asset, changeType, extras = {}) => {
    const snapshot = {
      id:                        nextId(),
      fixedAssetID:              asset.id,
      fixedAssetTypeID:          asset.fixedAssetTypeID,
      fixedAssetCategoryID:      asset.fixedAssetCategoryID,
      fixedAssetCode:            asset.code,
      fixedAssetName:            asset.name,
      groupID:                   asset.groupID,
      estateID:                  asset.estateID,
      totalCostOfAsset:          asset.totalCostOfAsset,
      residualValue:             asset.residualValue,
      implementationCost:        asset.implementationCost,
      implementationDate:        asset.implementationDate,
      startDate:                 asset.startDate,
      usefulLifeYears:           asset.usefulLifeYears,
      depreciationValue:         asset.depreciationValue,
      ledgerTransactionRef:      asset.ledgerTransactionRef,
      newUsefulLifeYears:        extras.newUsefulLifeYears   ?? null,
      newResidualValue:          extras.newResidualValue      ?? null,
      presentValue:              extras.presentValue          ?? null,
      newDepreciationRegisterNo: extras.newDepreciationRegisterNo ?? null,
      newDepreciationClaimDate:  extras.newDepreciationClaimDate  ?? null,
      assetMaintenanceID:        extras.assetMaintenanceID    ?? null,
      warrantyClaimDate:         extras.warrantyClaimDate     ?? null,
      changeDate:                new Date().toISOString().slice(0, 10),
      changeType,
    };
    _history = [..._history, snapshot];
    return snapshot;
  },
};
