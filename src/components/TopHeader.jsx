import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { alertsEngine } from '../data/alertsEngine';

function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatTime(d) {
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function TopHeader({ breadcrumb = [] }) {
  const clock      = useClock();
  const navigate   = useNavigate();
  const alertCount = alertsEngine.totalCount();

  return (
    <header className="top-header">
      {/* Logo */}
      <span className="header-logo">AgriGEN F & F</span>

      <div className="header-divider" />

      {/* Breadcrumb */}
      <div className="header-breadcrumb">
        <span>FleetPro</span>
        {breadcrumb.map((b, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="sep">›</span>
            {i === breadcrumb.length - 1
              ? <span className="current">{b}</span>
              : <span>{b}</span>
            }
          </span>
        ))}
      </div>

      {/* Right actions */}
      <div className="header-actions">
        <span className="header-clock">{clock}</span>
        <div className="header-divider" />
        <button
          id="header-btn-alerts"
          className="header-icon-btn"
          title={`${alertCount} alert${alertCount !== 1 ? 's' : ''}`}
          onClick={() => navigate('/alerts')}
          style={{ position: 'relative' }}
        >
          <Icon name="bell" style={{ width: 16, height: 16 }} />
          {alertCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 16, height: 16, borderRadius: 8,
              padding: '0 3px',
              background: 'var(--danger)', color: 'white',
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, pointerEvents: 'none',
            }}>
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </button>
        <div className="header-user">
          <div className="header-avatar">VS</div>
          <div className="header-user-info">
            <span className="header-user-name">Vishwa</span>
            <span className="header-user-role">ERP Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
