/**
 * Ledger Transaction store.
 * Holds all posted GL journal entry lines (one row per Dr or Cr side).
 *
 * IMMUTABILITY RULE: entries are never deleted or updated after posting.
 * Corrections use glEngine.reverse() which creates mirror reversal rows.
 * This preserves full audit history.
 *
 * Each document reference groups 2 or more lines that must net to zero
 * (Total Dr = Total Cr). The GL Engine enforces balance before calling addLines().
 *
 * Row structure:
 *   id                  — auto-assigned sequential integer
 *   documentReference   — e.g. 'CAP-20260001'
 *   batchReference      — depreciation batch e.g. 'DEP-BATCH-2026-04' (nullable)
 *   transactionDate     — ISO date string
 *   moduleCode          — 'FA' or 'FLEET'
 *   transactionTypeCode — e.g. 'FA_CAPITALIZATION'
 *   sourceTableName     — originating table e.g. 'FixedAsset'
 *   sourceRecordID      — PK of the source row
 *   lineDescription     — human-readable journal line label
 *   ledgerAccountID     — FK → LedgerAccount
 *   drCr                — 'DR' or 'CR'
 *   amount              — always positive; direction indicated by drCr
 *   isReversed          — true if this line is a reversal (created by glEngine.reverse())
 *   reversalOf          — ID of the original line this reverses (nullable)
 *   groupID             — FK → Group (nullable)
 *   estateID            — FK → Estate (nullable)
 *   createdBy           — username or 'System'
 *   createdDate         — ISO datetime string
 */

let _transactions = [];
let _idCounter    = 0;

export const ledgerTransactionStore = {
  /* ── Read ───────────────────────────────────────────────────────────── */

  getAll: () => [..._transactions],

  getById: (id) => _transactions.find(t => t.id === Number(id)),

  /** All lines for a specific document reference (the paired Dr+Cr set). */
  getByDocumentRef: (documentReference) =>
    _transactions.filter(t => t.documentReference === documentReference),

  /** All lines originating from a specific source record. */
  getBySource: (sourceTableName, sourceRecordID) =>
    _transactions.filter(
      t => t.sourceTableName === sourceTableName && t.sourceRecordID === Number(sourceRecordID)
    ),

  /** All lines in a depreciation batch. */
  getByBatchRef: (batchReference) =>
    _transactions.filter(t => t.batchReference === batchReference),

  /** Active (non-reversed) lines only — used for balance views. */
  getActive: () => _transactions.filter(t => !t.isReversed),

  /** Running balance for one account: { totalDr, totalCr, netBalance }. */
  sumByAccount(ledgerAccountID) {
    const lines = _transactions.filter(
      t => t.ledgerAccountID === Number(ledgerAccountID) && !t.isReversed
    );
    const totalDr = lines.filter(t => t.drCr === 'DR').reduce((s, t) => s + t.amount, 0);
    const totalCr = lines.filter(t => t.drCr === 'CR').reduce((s, t) => s + t.amount, 0);
    return { totalDr, totalCr, netBalance: totalDr - totalCr };
  },

  /* ── Write ──────────────────────────────────────────────────────────── */

  /**
   * Appends an array of pre-balanced journal lines.
   * IDs are auto-assigned — callers must NOT include an id field.
   *
   * @param {Array<object>} lines — array of line objects (without id)
   * @returns {Array<number>} — the assigned IDs in insertion order
   */
  addLines(lines) {
    const withIds = lines.map(line => ({ ...line, id: ++_idCounter }));
    _transactions = [..._transactions, ...withIds];
    return withIds.map(l => l.id);
  },

  /* ── Utilities ──────────────────────────────────────────────────────── */

  /** Total count of all lines (including reversals) — for diagnostics. */
  count: () => _transactions.length,

  /** Verify a document reference is balanced (Dr total = Cr total). */
  isBalanced(documentReference) {
    const lines = _transactions.filter(t => t.documentReference === documentReference);
    if (lines.length === 0) return false;
    const dr = lines.filter(t => t.drCr === 'DR').reduce((s, t) => s + t.amount, 0);
    const cr = lines.filter(t => t.drCr === 'CR').reduce((s, t) => s + t.amount, 0);
    return Math.abs(dr - cr) < 0.01;
  },
};
