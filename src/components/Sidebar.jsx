import { useLocation, useNavigate } from 'react-router-dom';
import { NAV } from '../nav';
import { Icon } from './Icon';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Icon name="car" />
        </div>
        <div className="sidebar-logo-text">
          <span className="app-name">AgriGEN</span>
          <span className="app-sub">F & F</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((group) => {
          /* ── Module header (divider + bold label, no nav items) ── */
          if (group.isModuleHeader) {
            return (
              <div key={group.section} style={{ marginTop: 18, marginBottom: 2, padding: '0 14px' }}>
                <div style={{ height: 1, background: 'var(--border)', marginBottom: 8 }} />
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--primary)',
                  display: 'block',
                }}>
                  {group.section}
                </span>
              </div>
            );
          }

          /* ── Regular nav section ── */
          return (
            <div key={group.section}>
              <p className="nav-section-label">{group.section}</p>
              {group.items.map((item) => {
                const navId = `nav-${item.path === '/' ? 'dashboard' : item.path.replace(/^\//, '').replace(/\//g, '-')}`;

                /* Coming-soon item — greyed out, non-navigable */
                if (item.comingSoon) {
                  return (
                    <div
                      key={item.path}
                      id={navId}
                      className="nav-item"
                      style={{
                        opacity: 0.45,
                        cursor: 'default',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name={item.icon} />
                        {item.label}
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        background: 'var(--border)',
                        color: 'var(--text-muted)',
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        Soon
                      </span>
                    </div>
                  );
                }

                /* Normal nav item */
                return (
                  <button
                    key={item.path}
                    id={navId}
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
