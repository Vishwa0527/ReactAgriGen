/**
 * Module-level store for Asset Disposals.
 * Records the write-off, sale, donation, or scrap of a fixed asset.
 *
 * Workflow (status is system-managed — never set by the form):
 *   add()      → creates in 'Draft' status — no side effects
 *   approve()  → Draft → Approved (records approvedBy)
 *   complete() → Approved → Completed (marks asset Disposed, closes depreciation, creates FA history snapshot)
 *
 * Only Draft records may be edited or deleted.
 */
import { MOCK } from './mockData';
import { fixedAssetStore } from './fixedAssetStore';
import { depreciationStore } from './depreciationStore';
import { fixedAssetHistoryStore } from './fixedAssetHistoryStore';

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

let _disposals = MOCK.assetDisposals.map(d => ({ ...GL_DEFAULTS, ...d }));

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

  /** Create a new disposal — always saved as Draft, no downstream side effects. */
  add: (data) => {
    const id = nextId();
    _disposals = [..._disposals, { ...data, id, status: 'Draft' }];
    return id;
  },

  /**
   * Advance Draft → Approved.
   * Records who authorised the disposal.
   */
  approve: (id, approvedBy) => {
    _disposals = _disposals.map(d =>
      d.id === Number(id) && d.status === 'Draft'
        ? { ...d, status: 'Approved', approvedBy }
        : d
    );
  },

  /**
   * Advance Approved → Completed.
   * Triggers all downstream side effects:
   *   1. Marks the linked FixedAsset as 'Disposed'
   *   2. Closes all active Depreciation schedules for that asset
   *   3. Creates an immutable FixedAssetHistory snapshot (EventType = 'Disposal')
   */
  complete: (id) => {
    const disposal = _disposals.find(d => d.id === Number(id));
    if (!disposal || disposal.status !== 'Approved') return;

    _disposals = _disposals.map(d =>
      d.id === Number(id) ? { ...d, status: 'Completed' } : d
    );

    // 1 — Mark asset as Disposed
    fixedAssetStore.update(disposal.fixedAssetID, { status: 'Disposed' });

    // 2 — Close all depreciation schedules for this asset
    depreciationStore.getByAssetId(disposal.fixedAssetID)
      .forEach(s => depreciationStore.update(s.id, { status: 'Closed' }));

    // 3 — Immutable FA history snapshot
    const asset = fixedAssetStore.getById(disposal.fixedAssetID);
    if (asset) {
      fixedAssetHistoryStore.addSnapshot(asset, 'Disposal', {
        presentValue: disposal.bookValueAtDisposal ?? null,
      });
    }
  },

  /** Update field data — only valid for Draft records; status is never changed here. */
  update: (id, data) => {
    const { status: _ignored, ...safeData } = data; // strip status — managed by workflow methods
    _disposals = _disposals.map(d =>
      d.id === Number(id) ? { ...d, ...safeData } : d
    );
  },

  /** Hard delete — only Draft records may be removed. */
  remove: (id) => {
    const disposal = _disposals.find(d => d.id === Number(id));
    if (!disposal || disposal.status !== 'Draft') return;
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
