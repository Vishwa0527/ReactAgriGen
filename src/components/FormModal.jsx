import { Icon } from './Icon';

/**
 * Reusable Add/Edit modal/form page shell.
 * Props: title, subtitle, onClose, onSave, children, isEdit, idPrefix
 *   idPrefix — used to generate stable element IDs for QA automation
 *              e.g. "vt" → vt-btn-modal-close, vt-btn-modal-cancel, vt-btn-modal-save
 */
export function FormModal({ title, subtitle, onClose, onSave, children, isEdit = false, idPrefix = 'modal', wide = false, saveLabel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: wide ? 900 : 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header">
          <div>
            <div className="card-header-title">{title}</div>
            {subtitle && <div className="card-header-sub">{subtitle}</div>}
          </div>
          <button
            id={`${idPrefix}-btn-modal-close`}
            className="btn-icon"
            onClick={onClose}
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="card-body" style={{ overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        <div className="card-footer">
          <button
            id={`${idPrefix}-btn-modal-cancel`}
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            id={`${idPrefix}-btn-modal-save`}
            className="btn btn-primary"
            onClick={onSave}
          >
            <Icon name="check" /> {saveLabel || (isEdit ? 'Update' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
