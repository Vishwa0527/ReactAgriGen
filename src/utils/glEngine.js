/**
 * GL Engine — central posting service for the AgriGEN ERP GL integration.
 *
 * Three public functions:
 *
 *   glEngine.preview(params)
 *     Dry-run: resolves account mappings and computes Dr/Cr lines without
 *     writing anything. Used by GLEffectPanel for live account-effect display.
 *
 *   glEngine.post(params)
 *     Validates balance, writes LedgerTransaction rows, returns documentReference.
 *     Called only when Finance clicks [Approve].
 *
 *   glEngine.reverse(originalDocumentRef, createdBy?)
 *     Creates mirror-image reversal lines (Dr↔Cr swapped) for a posted document.
 *     Original lines are preserved for audit. Returns the new reversal reference.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Amount resolution for multi-line disposal journals (lineRole system):
 *
 *   'FULL_AMOUNT'  → use params.amount (all 2-line entries)
 *   'ACCUM_DEP'    → use params.amounts.accumDep
 *   'PROCEEDS'     → use params.amounts.proceeds
 *   'ASSET_COST'   → use params.amounts.assetCost
 *   'GAIN_AMOUNT'  → use params.amounts.gainAmount
 *   'LOSS_AMOUNT'  → use params.amounts.lossAmount
 *
 * For disposal calls, pass `amounts` instead of (or in addition to) `amount`:
 *   glEngine.post({
 *     transactionTypeCode: 'FA_DISPOSAL_LOSS',
 *     amounts: {
 *       accumDep:   1750000,   // total accumulated depreciation on asset
 *       proceeds:    500000,   // sale / disposal proceeds
 *       assetCost:  2500000,   // original purchase cost
 *       lossAmount:  250000,   // NBV − proceeds (always positive)
 *     },
 *     ...
 *   })
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { glMappingStore }         from '../data/glMappingStore';
import { ledgerAccountStore }     from '../data/ledgerAccountStore';
import { documentReferenceStore } from '../data/documentReferenceStore';
import { ledgerTransactionStore } from '../data/ledgerTransactionStore';

/* ── Transaction type → DocumentReference type mapping ─────────────────── */
const TXN_TO_DOC_TYPE = {
  FA_CAPITALIZATION:    'FA-CAP',
  FA_DEPRECIATION:      'FA-DEP',
  FA_ASSET_MAINT:       'FA-MAINT',
  FLEET_MAINT_RECORD:   'FA-MAINT',
  FLEET_VEHICLE_SVC:    'FA-MAINT',
  FA_DISPOSAL_GAIN:     'FA-DISP',
  FA_DISPOSAL_LOSS:     'FA-DISP',
  FA_DISPOSAL_WRITEOFF: 'FA-DISP',
};

/* ── Module code derivation ─────────────────────────────────────────────── */
function moduleCode(transactionTypeCode) {
  return transactionTypeCode.startsWith('FLEET') ? 'FLEET' : 'FA';
}

/* ── Amount resolution for a single mapping line ────────────────────────── */
function lineAmount(lineRole, amount, amounts) {
  switch (lineRole) {
    case 'ACCUM_DEP':   return amounts.accumDep    ?? 0;
    case 'PROCEEDS':    return amounts.proceeds    ?? 0;
    case 'ASSET_COST':  return amounts.assetCost   ?? 0;
    case 'GAIN_AMOUNT': return amounts.gainAmount  ?? 0;
    case 'LOSS_AMOUNT': return amounts.lossAmount  ?? 0;
    default:            return amount ?? 0; // 'FULL_AMOUNT' or undefined
  }
}

/* ── Build enriched journal display lines from mapping lines ─────────────── */
function buildDisplayLines(mappingLines, amount, amounts) {
  return mappingLines.map(ml => {
    const account = ledgerAccountStore.getById(ml.ledgerAccountID);
    return {
      ledgerAccountID:  ml.ledgerAccountID,
      accountCode:      account?.accountCode  ?? '???',
      accountName:      account?.accountName  ?? 'Unknown Account',
      drCr:             ml.drCr,
      amount:           lineAmount(ml.lineRole ?? 'FULL_AMOUNT', amount, amounts),
      lineDescription:  ml.lineDescription,
      lineRole:         ml.lineRole ?? 'FULL_AMOUNT',
      sortOrder:        ml.sortOrder,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PUBLIC API
 * ═══════════════════════════════════════════════════════════════════════════ */

export const glEngine = {

  /**
   * preview() — compute the Dr/Cr account table for a transaction without
   * writing anything to the database.
   *
   * @param {object}       params
   * @param {string}       params.transactionTypeCode
   * @param {number}      [params.amount=0]            — primary amount (FULL_AMOUNT lines)
   * @param {number|null} [params.fixedAssetTypeID]
   * @param {number|null} [params.fixedAssetCategoryID]
   * @param {object}      [params.amounts={}]           — disposal multi-amounts
   *
   * @returns {{
   *   lines:    Array,    — enriched line objects for display
   *   drTotal:  number,
   *   crTotal:  number,
   *   balanced: boolean,  — true when |drTotal − crTotal| < 0.01
   *   missing:  boolean,  — true when no GL mapping is configured
   *   error:    string|null
   * }}
   */
  preview({
    transactionTypeCode,
    amount              = 0,
    fixedAssetTypeID    = null,
    fixedAssetCategoryID = null,
    amounts             = {},
  }) {
    const mappingLines = glMappingStore.resolveAccounts(
      transactionTypeCode,
      fixedAssetTypeID,
      fixedAssetCategoryID,
    );

    if (!mappingLines || mappingLines.length === 0) {
      return { lines: [], drTotal: 0, crTotal: 0, balanced: false, missing: true, error: null };
    }

    const lines   = buildDisplayLines(mappingLines, amount, amounts);
    const drTotal = lines.filter(l => l.drCr === 'DR').reduce((s, l) => s + l.amount, 0);
    const crTotal = lines.filter(l => l.drCr === 'CR').reduce((s, l) => s + l.amount, 0);
    const balanced = Math.abs(drTotal - crTotal) < 0.01;

    return { lines, drTotal, crTotal, balanced, missing: false, error: null };
  },

  /**
   * post() — validate balance and write journal entry lines to LedgerTransaction.
   * This is called only when Finance approves a record.
   *
   * @param {object}       params
   * @param {string}       params.transactionTypeCode
   * @param {string}       params.transactionDate        — ISO date 'YYYY-MM-DD'
   * @param {string}       params.sourceTableName        — e.g. 'FixedAsset'
   * @param {number}       params.sourceRecordID
   * @param {number}      [params.amount=0]
   * @param {number|null} [params.fixedAssetTypeID]
   * @param {number|null} [params.fixedAssetCategoryID]
   * @param {object}      [params.amounts={}]            — disposal multi-amounts
   * @param {string|null} [params.batchReference]        — depreciation batch ref
   * @param {string}      [params.description]           — optional line description prefix
   * @param {number|null} [params.groupID]
   * @param {number|null} [params.estateID]
   * @param {string}      [params.createdBy='System']
   *
   * @returns {{ success: boolean, documentReference: string|null, error: string|null }}
   *
   * Error codes:
   *   'GL_MAPPING_MISSING'       — no mapping configured for this type/category
   *   'UNBALANCED_ENTRY'         — Dr total ≠ Cr total (should not happen with correct mapping)
   *   'ZERO_AMOUNT_LINE'         — at least one line has amount = 0
   *   'UNKNOWN_TRANSACTION_TYPE' — transactionTypeCode not in TXN_TO_DOC_TYPE
   */
  post({
    transactionTypeCode,
    transactionDate,
    sourceTableName,
    sourceRecordID,
    amount               = 0,
    fixedAssetTypeID     = null,
    fixedAssetCategoryID = null,
    amounts              = {},
    batchReference       = null,
    description          = '',
    groupID              = null,
    estateID             = null,
    createdBy            = 'System',
  }) {
    /* 1. Validate via preview */
    const preview = glEngine.preview({
      transactionTypeCode,
      amount,
      fixedAssetTypeID,
      fixedAssetCategoryID,
      amounts,
    });

    if (preview.missing)   return { success: false, documentReference: null, error: 'GL_MAPPING_MISSING' };
    if (!preview.balanced) return { success: false, documentReference: null, error: 'UNBALANCED_ENTRY' };
    if (preview.lines.some(l => l.amount <= 0)) {
      return { success: false, documentReference: null, error: 'ZERO_AMOUNT_LINE' };
    }

    /* 2. Generate document reference */
    const docTypeCode = TXN_TO_DOC_TYPE[transactionTypeCode];
    if (!docTypeCode) return { success: false, documentReference: null, error: 'UNKNOWN_TRANSACTION_TYPE' };

    const documentReference = documentReferenceStore.getNext(docTypeCode);

    /* 3. Build and insert transaction rows */
    const now  = new Date().toISOString();
    const rows = preview.lines.map(l => ({
      documentReference,
      batchReference,
      transactionDate,
      moduleCode:           moduleCode(transactionTypeCode),
      transactionTypeCode,
      sourceTableName,
      sourceRecordID:       Number(sourceRecordID),
      lineDescription:      description ? `${description} — ${l.lineDescription}` : l.lineDescription,
      ledgerAccountID:      l.ledgerAccountID,
      drCr:                 l.drCr,
      amount:               l.amount,
      isReversed:           false,
      reversalOf:           null,
      groupID,
      estateID,
      createdBy,
      createdDate:          now,
    }));

    ledgerTransactionStore.addLines(rows);

    return { success: true, documentReference, error: null };
  },

  /**
   * reverse() — create mirror-image reversal lines for a previously posted document.
   *
   * The original lines are NOT modified or deleted (audit trail preservation).
   * New reversal rows have isReversed=true and reversalOf=originalLineID.
   * A new DocumentReference is generated for the reversal.
   *
   * @param {string} originalDocumentRef — the document reference to reverse
   * @param {string} [createdBy='System']
   *
   * @returns {{ success: boolean, reversalRef: string|null, error: string|null }}
   *
   * Error codes:
   *   'DOCUMENT_NOT_FOUND' — no lines with that document reference
   *   'ALREADY_REVERSED'   — at least one line in the document is already a reversal
   */
  reverse(originalDocumentRef, createdBy = 'System') {
    const originalLines = ledgerTransactionStore.getByDocumentRef(originalDocumentRef);

    if (!originalLines || originalLines.length === 0) {
      return { success: false, reversalRef: null, error: 'DOCUMENT_NOT_FOUND' };
    }
    if (originalLines.some(l => l.isReversed)) {
      return { success: false, reversalRef: null, error: 'ALREADY_REVERSED' };
    }

    /* Generate reversal document reference */
    const txnTypeCode = originalLines[0].transactionTypeCode;
    const docTypeCode = TXN_TO_DOC_TYPE[txnTypeCode];
    const reversalRef = documentReferenceStore.getNext(docTypeCode);

    const now = new Date().toISOString();

    const reversalRows = originalLines.map(l => ({
      documentReference: reversalRef,
      batchReference:    l.batchReference ? `REV-${l.batchReference}` : null,
      transactionDate:   l.transactionDate,
      moduleCode:        l.moduleCode,
      transactionTypeCode: l.transactionTypeCode,
      sourceTableName:   l.sourceTableName,
      sourceRecordID:    l.sourceRecordID,
      lineDescription:   `[Reversal of ${originalDocumentRef}] ${l.lineDescription}`,
      ledgerAccountID:   l.ledgerAccountID,
      drCr:              l.drCr === 'DR' ? 'CR' : 'DR', // swap direction
      amount:            l.amount,
      isReversed:        true,
      reversalOf:        l.id,
      groupID:           l.groupID,
      estateID:          l.estateID,
      createdBy,
      createdDate:       now,
    }));

    ledgerTransactionStore.addLines(reversalRows);

    return { success: true, reversalRef, error: null };
  },

  /**
   * previewDisposal() — convenience wrapper for disposal journal previews.
   * Automatically determines GAIN / LOSS / WRITEOFF transaction type from
   * the supplied financial figures, then calls preview().
   *
   * @param {object} params
   * @param {number}  params.purchaseCost        — original asset cost
   * @param {number}  params.accumulatedDep       — total depreciation posted to date
   * @param {number}  params.saleProceeds         — disposal proceeds (0 for write-off)
   * @param {number}  params.fixedAssetTypeID
   * @param {number} [params.fixedAssetCategoryID]
   *
   * @returns {{
   *   transactionTypeCode: string,
   *   nbv:        number,   — net book value
   *   gainLoss:   number,   — positive = gain, negative = loss
   *   ...preview result
   * }}
   */
  previewDisposal({
    purchaseCost,
    accumulatedDep,
    saleProceeds,
    fixedAssetTypeID,
    fixedAssetCategoryID = null,
  }) {
    const nbv       = purchaseCost - accumulatedDep;
    const gainLoss  = saleProceeds - nbv;

    let transactionTypeCode;
    let amounts;

    if (saleProceeds === 0 && accumulatedDep < purchaseCost) {
      /* Write-off / Scrap — no proceeds */
      transactionTypeCode = 'FA_DISPOSAL_WRITEOFF';
      amounts = {
        accumDep:   accumulatedDep,
        assetCost:  purchaseCost,
        lossAmount: nbv, // remaining NBV is the loss
      };
    } else if (gainLoss >= 0) {
      /* Gain on disposal */
      transactionTypeCode = 'FA_DISPOSAL_GAIN';
      amounts = {
        accumDep:   accumulatedDep,
        proceeds:   saleProceeds,
        assetCost:  purchaseCost,
        gainAmount: gainLoss,
      };
    } else {
      /* Loss on disposal */
      transactionTypeCode = 'FA_DISPOSAL_LOSS';
      amounts = {
        accumDep:   accumulatedDep,
        proceeds:   saleProceeds,
        assetCost:  purchaseCost,
        lossAmount: Math.abs(gainLoss),
      };
    }

    const result = glEngine.preview({
      transactionTypeCode,
      amount: 0,
      fixedAssetTypeID,
      fixedAssetCategoryID,
      amounts,
    });

    return { ...result, transactionTypeCode, nbv, gainLoss, amounts };
  },
};
