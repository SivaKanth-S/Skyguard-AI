import React from 'react';
import { useNotify } from '../context/NotifyContext';

// Floating notification stack fixed to the viewport — renders above every
// page and map (including fullscreen), so alerts are never trapped inside
// a single map container.
const SEV = {
  critical: { icon: '🚨', cls: 'critical' },
  warning: { icon: '⚠️', cls: 'warning' },
  info: { icon: '🔔', cls: 'info' },
  success: { icon: '✅', cls: 'success' },
};

export default function WebsiteNotifications() {
  const { notifications, dismiss, clear } = useNotify();
  if (!notifications.length) return null;

  return (
    <div className="web-notify-stack" role="region" aria-live="polite" aria-label="Notifications">
      <div className="web-notify-head">
        <span>🔔 Notifications ({notifications.length})</span>
        <button className="web-notify-clear" onClick={clear}>Clear all</button>
      </div>
      {notifications.map((n) => {
        const meta = SEV[n.severity] || SEV.info;
        return (
          <div key={n.id} className={`web-notify-card ${meta.cls}`} role="alert">
            <span className="web-notify-icon">{meta.icon}</span>
            <div className="web-notify-body">
              <strong>{n.title}</strong>
              {n.detail ? <span>{n.detail}</span> : null}
              <small>{n.time}</small>
            </div>
            <button
              className="web-notify-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(n.id)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
