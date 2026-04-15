/**
 * ReportShell — wrapper for every report view.
 * Provides:
 *   - Screen: card header with title, subtitle, Print and Export CSV buttons
 *   - Print:  logo + title + generated-date header (hidden on screen)
 */
import { Icon } from './Icon';

export function ReportShell({ title, subtitle, onExportCsv, children }) {
  return (
    <div className="fade-up">

      {/* ── Print-only header (hidden on screen) ── */}
      <div className="print-only" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #0d9488' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0d9488' }}>AgriGEN F &amp; F</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#555' }}>
            <div>Generated</div>
            <div style={{ fontWeight: 600 }}>
              {new Date().toLocaleDateString('en-LK', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Screen card ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-header-title">{title}</div>
            {subtitle && <div className="card-header-sub">{subtitle}</div>}
          </div>
          <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onExportCsv && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onExportCsv}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Icon name="file" style={{ width: 13, height: 13 }} />
                Export CSV
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Icon name="clipboard" style={{ width: 13, height: 13 }} />
              Print
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
