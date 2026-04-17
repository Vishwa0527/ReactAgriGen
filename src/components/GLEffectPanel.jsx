/**
 * GLEffectPanel — embedded component that shows the expected GL journal entry
 * and drives the GL approval workflow for any source document.
 *
 * Workflow states rendered:
 *   Draft           → "Submit for Approval" button (calls onConfirm)
 *   PendingApproval → "Approve" + "Reject" buttons (calls onApprove / onReject)
 *   Approved        → green posted-reference banner; no action buttons
 *   Rejected        → red rejection-note banner + "Resubmit" button (calls onResubmit)
 *
 * The parent is responsible for all store mutations.
 * This component only fires callbacks and shows current state.
 *
 * Props:
 *   transactionTypeCode    {string}       — e.g. 'FA_CAPITALIZATION'
 *   fixedAssetTypeID       {number|null}  — for account resolution priority
 *   fixedAssetCategoryID   {number|null}  — category-level override
 *   amount                 {number}       — primary amount (0 for disposal entries)
 *   amounts                {object}       — disposal multi-amounts:
 *                                           { accumDep, proceeds, assetCost, gainAmount, lossAmount }
 *   glApprovalStatus       {string}       — 'Draft' | 'PendingApproval' | 'Approved' | 'Rejected'
 *   glPostingRef           {string|null}  — document reference after posting
 *   glRejectionNote        {string|null}  — rejection reason
 *   isPostedToGL           {boolean}
 *   idPrefix               {string}       — scopes interactive element IDs (default 'glp')
 *
 * Callbacks (omit to hide the corresponding button):
 *   onConfirm()            — called when user submits for approval
 *   onApprove()            — called when approver approves
 *   onReject(note)         — called with rejection note string
 *   onResubmit()           — called when user resubmits after rejection
 */

import { useState, useMemo } from 'react';
import { glEngine }           from '../utils/glEngine';
import { GLStatusBadge }      from './GLStatusBadge';
import { Icon }               from './Icon';

const fmt = (n) =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GLEffectPanel({
  transactionTypeCode,
  fixedAssetTypeID     = null,
  fixedAssetCategoryID = null,
  amount               = 0,
  amounts              = {},
  glApprovalStatus     = 'Draft',
  glPostingRef         = null,
  glRejectionNote      = null,
  isPostedToGL         = false,
  idPrefix             = 'glp',
  onConfirm,
  onApprove,
  onReject,
  onResubmit,
}) {
  const [rejectMode,  setRejectMode]  = useState(false);
  const [rejectNote,  setRejectNote]  = useState('');
  const [rejectError, setRejectError] = useState('');

  /* Preview is synchronous — recompute when any input changes.
   * amounts is serialised so inline-object props don't break the memo. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preview = useMemo(() => {
    if (!transactionTypeCode) return null;
    return glEngine.preview({
      transactionTypeCode,
      amount,
      fixedAssetTypeID,
      fixedAssetCategoryID,
      amounts,
    });
  // JSON.stringify(amounts) gives a stable dep for object values passed inline
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionTypeCode, amount, fixedAssetTypeID, fixedAssetCategoryID, JSON.stringify(amounts)]);

  if (!transactionTypeCode) return null;

  /* ── workflow flags ───────────────────────────────────────────────────── */
  const canConfirm  = !!onConfirm  && glApprovalStatus === 'Draft';
  const canApprove  = !!onApprove  && glApprovalStatus === 'PendingApproval';
  const canReject   = !!onReject   && glApprovalStatus === 'PendingApproval' && !rejectMode;
  const canResubmit = !!onResubmit && glApprovalStatus === 'Rejected';
  const hasActions  = canConfirm || canApprove || canReject || canResubmit;

  /* ── rejection handler ────────────────────────────────────────────────── */
  const handleReject = () => {
    if (!rejectNote.trim()) { setRejectError('Rejection note is required'); return; }
    onReject(rejectNote.trim());
    setRejectMode(false);
    setRejectNote('');
    setRejectError('');
  };

  const cancelReject = () => {
    setRejectMode(false);
    setRejectNote('');
    setRejectError('');
  };

  /* ── zero-amount hint — only show when no amounts at all ─────────────── */
  const isZeroEntry = amount === 0 && Object.values(amounts).every(v => !v || v === 0);

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      background: 'var(--bg-card)',
      overflow: 'hidden',
    }}>

      {/* ── Panel header ── */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="dollar" style={{ width: 14, height: 14, color: 'var(--primary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            GL Effect
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {transactionTypeCode}
          </span>
        </div>
        <GLStatusBadge status={glApprovalStatus} isPostedToGL={isPostedToGL} />
      </div>

      {/* ── Missing mapping warning ── */}
      {preview?.missing && (
        <div style={{
          padding: '10px 14px',
          background: '#fffbeb',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12,
          color: '#92400e',
        }}>
          <Icon name="alert" style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
          <span>
            No GL mapping configured for <strong>{transactionTypeCode}</strong>
            {fixedAssetTypeID ? ' with this asset type' : ''}.
            {' '}Set it up in <em>GL Account Mapping</em> before approving.
          </span>
        </div>
      )}

      {/* ── Journal preview table ── */}
      {preview && !preview.missing && preview.lines.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={TH_STYLE({ width: 56 })}>Dr/Cr</th>
                <th style={TH_STYLE()}>Account</th>
                <th style={TH_STYLE({ width: 150, textAlign: 'right' })}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((line, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--bg-subtle, #f8fafc)' }}>
                  <td style={TD_STYLE({ width: 56 })}>
                    <span
                      className={`badge ${line.drCr === 'DR' ? 'badge-primary' : 'badge-success'}`}
                      style={{ fontSize: 10 }}
                    >
                      {line.drCr}
                    </span>
                  </td>
                  <td style={TD_STYLE()}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                      {line.accountCode}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{line.accountName}</span>
                  </td>
                  <td style={TD_STYLE({ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 })}>
                    {isZeroEntry
                      ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                      : fmt(line.amount)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            {!isZeroEntry && (
              <tfoot>
                <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={2} style={{ padding: '7px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Totals</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        DR&nbsp;{fmt(preview.drTotal)}
                      </span>
                      <span style={{ color: 'var(--success, #16a34a)', fontWeight: 600 }}>
                        CR&nbsp;{fmt(preview.crTotal)}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                    {preview.balanced ? (
                      <span style={{
                        color: 'var(--success, #16a34a)', fontSize: 11,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}>
                        <Icon name="check" style={{ width: 11, height: 11 }} /> Balanced
                      </span>
                    ) : (
                      <span style={{
                        color: 'var(--danger)', fontSize: 11,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}>
                        <Icon name="alert" style={{ width: 11, height: 11 }} /> Unbalanced
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── Hint when amount is zero ── */}
      {preview && !preview.missing && isZeroEntry && (
        <div style={{
          padding: '8px 14px',
          background: '#fffbeb',
          borderTop: '1px solid var(--border)',
          fontSize: 11, color: '#92400e',
          display: 'flex', gap: 7, alignItems: 'center',
        }}>
          <Icon name="alert" style={{ width: 12, height: 12, flexShrink: 0 }} />
          Enter a non-zero amount to preview correct journal values.
        </div>
      )}

      {/* ── Posted-to-GL banner ── */}
      {isPostedToGL && glPostingRef && (
        <div style={{
          padding: '9px 14px',
          background: '#f0fdf4',
          borderTop: '1px solid var(--border)',
          fontSize: 12, color: '#166534',
          display: 'flex', gap: 7, alignItems: 'center',
        }}>
          <Icon name="check" style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>
            Posted to GL — Ref:&nbsp;
            <strong style={{ fontFamily: 'monospace' }}>{glPostingRef}</strong>
          </span>
        </div>
      )}

      {/* ── Rejection note banner ── */}
      {glApprovalStatus === 'Rejected' && glRejectionNote && !rejectMode && (
        <div style={{
          padding: '9px 14px',
          background: '#fef2f2',
          borderTop: '1px solid var(--border)',
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <Icon name="alert" style={{ width: 13, height: 13, color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong style={{ color: 'var(--danger)' }}>Rejected: </strong>
              <span style={{ color: 'var(--text-secondary)' }}>{glRejectionNote}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline rejection form ── */}
      {rejectMode && (
        <div style={{
          padding: '12px 14px',
          background: '#fef2f2',
          borderTop: '1px solid var(--border)',
        }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
            Rejection Note <span className="required">*</span>
          </label>
          <textarea
            id={`${idPrefix}-glp-textarea-reject-note`}
            className={`form-control${rejectError ? ' input-error' : ''}`}
            value={rejectNote}
            onChange={e => { setRejectNote(e.target.value); if (rejectError) setRejectError(''); }}
            placeholder="Explain why this GL posting is being rejected…"
            rows={2}
            style={{ fontSize: 13 }}
          />
          {rejectError && <span className="field-error">{rejectError}</span>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              id={`${idPrefix}-glp-btn-reject-confirm`}
              className="btn btn-danger btn-sm"
              onClick={handleReject}
            >
              <Icon name="check" style={{ width: 12, height: 12 }} /> Confirm Rejection
            </button>
            <button
              id={`${idPrefix}-glp-btn-reject-cancel`}
              className="btn btn-secondary btn-sm"
              onClick={cancelReject}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      {hasActions && !rejectMode && (
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {canConfirm && (
            <button
              id={`${idPrefix}-glp-btn-submit`}
              className="btn btn-primary btn-sm"
              onClick={onConfirm}
            >
              <Icon name="upload" style={{ width: 12, height: 12 }} /> Submit for Approval
            </button>
          )}
          {canApprove && (
            <button
              id={`${idPrefix}-glp-btn-approve`}
              className="btn btn-primary btn-sm"
              onClick={onApprove}
            >
              <Icon name="check" style={{ width: 12, height: 12 }} /> Approve
            </button>
          )}
          {canReject && (
            <button
              id={`${idPrefix}-glp-btn-reject`}
              className="btn btn-danger btn-sm"
              onClick={() => setRejectMode(true)}
            >
              Reject
            </button>
          )}
          {canResubmit && (
            <button
              id={`${idPrefix}-glp-btn-resubmit`}
              className="btn btn-secondary btn-sm"
              onClick={onResubmit}
            >
              <Icon name="upload" style={{ width: 12, height: 12 }} /> Resubmit
            </button>
          )}
        </div>
      )}

    </div>
  );
}

/* ── Shared table cell style helpers ─────────────────────────────────── */
function TH_STYLE(overrides = {}) {
  return {
    padding: '7px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11,
    color: 'var(--text-secondary)',
    background: 'var(--bg-subtle)',
    borderBottom: '1px solid var(--border)',
    ...overrides,
  };
}

function TD_STYLE(overrides = {}) {
  return {
    padding: '7px 12px',
    verticalAlign: 'middle',
    ...overrides,
  };
}
