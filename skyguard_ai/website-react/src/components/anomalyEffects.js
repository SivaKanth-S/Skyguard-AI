import L from 'leaflet';

// Shared anomaly-detection map effects, ported to React from the vanilla
// `SG.triggerInjectAnimation` system introduced in commit b3c0408
// ("map and station changes"). The CSS for these classes
// (.sg-anomaly-anim-container, .sg-shockwave-ring, .sg-target-reticle,
// .sg-floating-anomaly-badge, .sg-map-hud-banner) already lives in
// styles/style.css — these helpers finally drive them from the React maps.

export const BURST_TTL_MS = 4200;
export const HUD_TTL_MS = 5500;
export const BURST_COOLDOWN_MS = 12000;

// Tamil Nadu fence shared by both maps — neither map can pan or zoom out
// past the state. Bounds cover lat 8.07–13.55 / lng 76.05–80.35 with margin.
export const TN_BOUNDS = L.latLngBounds([7.5, 75.5], [14.0, 80.9]);
export const TN_CENTER = [11.1271, 78.6569];
export const TN_ZOOM = 7;
export const TN_MIN_ZOOM = 7;

export const ANOMALY_META = {
  HEALTHY:  { color: '#2ecc71', glow: 'rgba(46,204,113,.45)',  icon: '✅', label: 'Normal' },
  NORMAL:   { color: '#2ecc71', glow: 'rgba(46,204,113,.45)',  icon: '✅', label: 'Normal' },
  DEGRADED: { color: '#f39c12', glow: 'rgba(243,156,18,.45)',  icon: '⚠️', label: 'Degraded' },
  FAULT:    { color: '#e67e22', glow: 'rgba(230,126,34,.45)',  icon: '⚡', label: 'Fault' },
  CRITICAL: { color: '#e74c3c', glow: 'rgba(231,76,60,.5)',    icon: '🚨', label: 'Critical' },
  ADVISORY: { color: '#f39c12', glow: 'rgba(243,156,18,.45)',  icon: '👁️', label: 'Advisory' },
  WARNING:  { color: '#e67e22', glow: 'rgba(230,126,34,.45)',  icon: '⚠️', label: 'Warning' },
  THREAT:   { color: '#e74c3c', glow: 'rgba(231,76,60,.5)',    icon: '🚨', label: 'Threat' },
  CUSTOM:   { color: '#58a6ff', glow: 'rgba(88,166,255,.45)',  icon: '📡', label: 'Custom' },
};

export function metaFor(status) {
  return ANOMALY_META[status] || ANOMALY_META.CRITICAL;
}

// Per-fault-type meta — the burst badge, reticle, rings, and HUD all take
// the fault's own color/icon/label (spike ≠ freeze ≠ drift ≠ out-of-range)
// instead of one generic severity look.
export const FAULT_META = {
  spike:   { color: '#ff3b30', glow: 'rgba(255,59,48,.45)',  icon: '🌡️', label: 'Temperature Spike' },
  freeze:  { color: '#00d2ff', glow: 'rgba(0,210,255,.45)',  icon: '🧊', label: 'Frozen Sensor' },
  drift:   { color: '#f39c12', glow: 'rgba(243,156,18,.45)', icon: '📉', label: 'Calibration Drift' },
  oor:     { color: '#ff0055', glow: 'rgba(255,0,85,.5)',    icon: '⛔', label: 'Out-of-Range' },
  multi:   { color: '#9b59b6', glow: 'rgba(155,89,182,.45)', icon: '👾', label: 'Multivariate Fault' },
  noise:   { color: '#e67e22', glow: 'rgba(230,126,34,.45)', icon: '🔊', label: 'Noise Burst' },
  missing: { color: '#ff416c', glow: 'rgba(255,65,108,.5)',  icon: '📡', label: 'Communication Loss' },
};

export function faultMeta(faultType, status) {
  if (faultType && FAULT_META[faultType]) return FAULT_META[faultType];
  return metaFor(status);
}

export function isAnomalyStatus(status) {
  return status != null && status !== 'HEALTHY' && status !== 'NORMAL';
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// One-shot detection burst: concentric shockwave rings + cyber reticle snap +
// floating badge. Mirrors b3c0408's SG.triggerInjectAnimation markup so the
// existing CSS applies unchanged. No-op (null) under reduced-motion.
export function spawnAnomalyBurst(map, { lat, lng, status, title, subtitle, faultType }) {
  if (!map || lat == null || lng == null) return null;
  if (prefersReducedMotion()) return null;
  const meta = faultMeta(faultType, status);
  const safeTitle = escapeHtml(title || meta.label);
  const safeSub = escapeHtml(subtitle || '');

  const html = `
    <div class="sg-anomaly-anim-container" style="--an-color:${meta.color};--an-glow:${meta.glow}">
      <div class="sg-shockwave-ring ring-1"></div>
      <div class="sg-shockwave-ring ring-2"></div>
      <div class="sg-shockwave-ring ring-3"></div>
      <div class="sg-target-reticle">
        <div class="reticle-corner tl"></div>
        <div class="reticle-corner tr"></div>
        <div class="reticle-corner bl"></div>
        <div class="reticle-corner br"></div>
        <div class="reticle-center-dot"></div>
      </div>
      <div class="sg-floating-anomaly-badge">
        <span class="an-icon">${meta.icon}</span>
        <div class="an-info">
          <div class="an-title">${safeTitle}</div>
          ${safeSub ? `<div class="an-desc">${safeSub}</div>` : ''}
        </div>
      </div>
    </div>`;

  const marker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'sg-anim-leaflet-wrapper',
      html,
      iconSize: [200, 200],
      iconAnchor: [100, 100],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 1000,
  }).addTo(map);

  const timer = setTimeout(() => {
    try { map.removeLayer(marker); } catch { /* map torn down */ }
  }, BURST_TTL_MS);

  return () => {
    clearTimeout(timer);
    try { map.removeLayer(marker); } catch { /* already removed */ }
  };
}

// Persistent severity halo rendered behind an anomalous station dot.
// Duration encodes severity: CRITICAL pulses fastest, DEGRADED slowest.
const HALO_DUR = { CRITICAL: '1.2s', FAULT: '1.6s', WARNING: '1.6s', THREAT: '1.2s', DEGRADED: '2.2s', ADVISORY: '2.2s' };

export function haloDivIcon(status) {
  const meta = metaFor(status);
  return L.divIcon({
    className: 'sg-anim-leaflet-wrapper',
    html: `<div class="sg-sev-halo" style="--an-color:${meta.color};--an-glow:${meta.glow};--halo-dur:${HALO_DUR[status] || '1.6s'}"></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}
