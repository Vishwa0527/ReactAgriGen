/**
 * Document Reference store.
 * Generates and tracks sequential reference numbers per document type.
 *
 * Each call to getNext() increments the internal counter and returns a
 * formatted reference string.
 *
 * Reference format: {Prefix}{YYYY}{NNNN}
 *   e.g.  CAP-20260001   (Asset Capitalization Journal #1 of 2026)
 *         DEP-20260001   (Depreciation Posting #1 of 2026)
 *         DISP-20260001  (Asset Disposal Journal #1 of 2026)
 *         MAINT-20260001 (Maintenance Cost Journal #1 of 2026)
 *         JV-20260001    (General Journal Voucher #1 of 2026)
 *
 * Batch references (depreciation runs) use a different helper:
 *   buildBatchRef('FA-DEP', 'April 2026') → 'DEP-BATCH-2026-04'
 */

let _refs = [
  { id: 1, documentTypeCode: 'FA-CAP',   prefix: 'CAP-',   lastNumber: 0, lastGeneratedRef: null, description: 'Asset Capitalization Journals' },
  { id: 2, documentTypeCode: 'FA-DEP',   prefix: 'DEP-',   lastNumber: 0, lastGeneratedRef: null, description: 'Depreciation Posting Journals' },
  { id: 3, documentTypeCode: 'FA-DISP',  prefix: 'DISP-',  lastNumber: 0, lastGeneratedRef: null, description: 'Asset Disposal Journals'       },
  { id: 4, documentTypeCode: 'FA-MAINT', prefix: 'MAINT-', lastNumber: 0, lastGeneratedRef: null, description: 'Maintenance Cost Journals'     },
  { id: 5, documentTypeCode: 'JV',       prefix: 'JV-',    lastNumber: 0, lastGeneratedRef: null, description: 'General Journal Vouchers'      },
];

export const documentReferenceStore = {
  getAll: () => _refs.map(r => ({ ...r })),

  /**
   * Increments the counter for the given document type and returns the
   * next formatted reference string.
   *
   * @param {string} documentTypeCode — e.g. 'FA-CAP', 'FA-DEP', 'FA-DISP', 'FA-MAINT', 'JV'
   * @returns {string|null} — e.g. 'CAP-20260001', or null if type not found
   */
  getNext(documentTypeCode) {
    const ref = _refs.find(r => r.documentTypeCode === documentTypeCode);
    if (!ref) return null;
    ref.lastNumber += 1;
    const year = new Date().getFullYear();
    const formatted = `${ref.prefix}${year}${String(ref.lastNumber).padStart(4, '0')}`;
    ref.lastGeneratedRef = formatted;
    return formatted;
  },

  /**
   * Returns the next reference that WOULD be generated without incrementing.
   * Safe to call multiple times — does not mutate state.
   *
   * @param {string} documentTypeCode
   * @returns {string|null}
   */
  peekNext(documentTypeCode) {
    const ref = _refs.find(r => r.documentTypeCode === documentTypeCode);
    if (!ref) return null;
    const year = new Date().getFullYear();
    return `${ref.prefix}${year}${String(ref.lastNumber + 1).padStart(4, '0')}`;
  },

  /**
   * Builds a batch reference string for depreciation runs.
   * Format: DEP-BATCH-YYYY-MM
   * e.g. buildBatchRef(new Date('2026-04-30')) → 'DEP-BATCH-2026-04'
   *
   * @param {string} periodDate — ISO date string representing the period end (e.g. '2026-04-30')
   * @returns {string}
   */
  buildBatchRef(periodDate) {
    const d = new Date(periodDate);
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `DEP-BATCH-${year}-${month}`;
  },
};
