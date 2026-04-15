/**
 * Module-level store for Asset Disposals.
 * Records the write-off, sale, donation, or scrap of a fixed asset.
 * On add: marks asset as 'Disposed', closes depreciation schedule,
 *         auto-creates a Fixed Asset History snapshot.
 * ID prefix: 'ad' (listing), 'adf' (form)
 */
import { MOCK } from './mockData';
import { fixedAssetStore } from './fixedAssetStore';
import { depreciationStore } from './depreciationStore';
import { fixedAssetHistoryStore } from './fixedAssetHistoryStore';

let _disposals = MOCK.assetDisposals.map(d => ({ ...d }));

function nextCode() {
  const max = _disposals.reduce((m, d) => {
    const n = parseInt(d.disposalCode?.replace('AD-', '') || '0', 10);
    return n > m ? n : m;
  }, 0);
  return `AD-${String(max + 1).padStart(4, '0')}`;
}

function nextId() {
  return _disposals.length ? Math.max(..._disposals.map(d => d.id)) + 1 : 1;
}

export const assetDisposalStore = {
  getAll:       ()    => [..._disposals],
  getById:      (id)  => _disposals.find(d => d.id === Number(id)),
  getByAssetId: (assetID) => _disposals.filter(d => d.fixedAssetID === Number(assetID)),
  nextCode,
  isCodeUnique: (code, excludeID = null) =>
    !_disposals.some(d => d.disposalCode === code && d.id !== excludeID),

  add: (data) => {
    const id = nextId();
    _disposals = [..._disposals, { id, ...data }];

    // Mark asset as Disposed
    fixedAssetStore.update(data.fixedAssetID, { status: 'Disposed' });

    // Close all depreciation schedules for this asset
    depreciationStore.getByAssetId(data.fixedAssetID)
      .forEach(s => depreciationStore.update(s.id, { status: 'Closed' }));

    // Auto-create immutable history snapshot
    const asset = fixedAssetStore.getById(data.fixedAssetID);
    if (asset) {
      fixedAssetHistoryStore.addSnapshot(asset, 'Disposal', {
        presentValue: data.bookValueAtDisposal ?? null,
      });
    }

    return id;
  },

  update: (id, data) => {
    _disposals = _disposals.map(d => d.id === Number(id) ? { ...d, ...data } : d);
  },

  remove: (id) => {
    _disposals = _disposals.filter(d => d.id !== Number(id));
  },

  /** Aggregates for listing stats */
  totalSaleProceeds: () =>
    _disposals
      .filter(d => d.disposalType === 'Sale')
      .reduce((s, d) => s + (d.saleProceeds || 0), 0),

  totalGainLoss: () =>
    _disposals
      .filter(d => d.disposalType === 'Sale')
      .reduce((s, d) => s + (d.gainLossOnDisposal || 0), 0),
};
