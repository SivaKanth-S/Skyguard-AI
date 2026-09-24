import React from 'react';
import { faultMeta } from './anomalyEffects';

// Single shared anomaly HUD banner — rendered identically by the dashboard
// map (StationMap) and the live-location map (LocationMap) so a detected
// fault looks the same on both. Colors/icon follow the specific fault type
// (spike / freeze / drift / out-of-range), falling back to severity.
// Auto-dismiss timing lives in the parent.
export default function AnomalyHudBanner({ hud, onClose, badgePrefix }) {
  if (!hud) return null;
  const meta = faultMeta(hud.faultType, hud.status);
  const badge = badgePrefix ?? `${meta.icon} ${meta.label}`;
  return (
    <div
      className="sg-map-hud-banner active"
      style={{
        borderColor: meta.color,
        boxShadow: `0 8px 32px ${meta.glow}`,
      }}
      role="alert"
    >
      <div className="hud-content">
        <span className="hud-badge" style={{ background: meta.color }}>
          {badge}
        </span>
        <div className="hud-text">
          <strong>{hud.title}</strong>
          {hud.detail ? <span>{hud.detail}</span> : null}
        </div>
      </div>
      <button className="hud-close" onClick={onClose} aria-label="Dismiss anomaly alert">
        ×
      </button>
    </div>
  );
}
