export const ANOMALY_TYPES = [
  {
    id: 'spike',
    badge: 'SPIKE',
    badgeClass: 'spike',
    cat: 'sensor',
    severity: 'HIGH – CRITICAL',
    title: 'Sensor Spike / Transient Fault',
    desc: 'Sudden extreme value followed by return to normal. Detected via rate-of-change threshold (|ΔT/Δt| > 10°C/step).',
    example: 'T: 34 → 72°C → 35°C in 20 min',
    detection: 'Rule: temperature_roc1 > 10 + IsolationForest',
    action: 'Cross-validate with neighbouring stations. Check sensor wiring.',
    chartColor: '#e74c3c',
    generatePoints: () => {
      const pts = Array.from({ length: 30 }, (_, i) => 34 + Math.sin(i / 4) * 0.4 + (Math.random() - 0.5) * 0.16);
      pts[18] = 72;
      return pts;
    }
  },
  {
    id: 'frozen',
    badge: 'FROZEN',
    badgeClass: 'frozen',
    cat: 'sensor',
    severity: 'MEDIUM – HIGH',
    title: 'Frozen / Stuck Sensor',
    desc: 'Sensor reports identical values for an extended period. Rolling unique-value ratio drops near zero over 18+ steps.',
    example: 'H: 65.3% repeated for 3+ hours',
    detection: 'frozen_18 > 15 + s_std < 0.001',
    action: 'Power cycle sensor. Check for mechanical blockage or icing.',
    chartColor: '#3498db',
    generatePoints: () => {
      const pts = Array.from({ length: 30 }, (_, i) => 34 + Math.sin(i / 4) * 0.3 + (Math.random() - 0.5) * 0.1);
      for (let i = 12; i < 28; i++) pts[i] = pts[11];
      return pts;
    }
  },
  {
    id: 'drift',
    badge: 'DRIFT',
    badgeClass: 'drift',
    cat: 'sensor',
    severity: 'LOW – MEDIUM',
    title: 'Calibration Drift',
    desc: 'Gradual systematic offset from expected values. Long-window Z-score divergence beyond ±3σ sustained over hours.',
    example: 'P: +0.5 hPa/hr offset for 8 hours',
    detection: 'zscore_long > 3σ sustained + RandomForest pattern',
    action: 'Schedule recalibration. Compare against reference station.',
    chartColor: '#b58105',
    generatePoints: () => {
      const pts = Array.from({ length: 30 }, (_, i) => 1005 + Math.sin(i / 4) * 0.2 + (Math.random() - 0.5) * 0.08);
      for (let i = 10; i < 30; i++) pts[i] += (i - 10) * 0.8;
      return pts;
    }
  },
  {
    id: 'oor',
    badge: 'OUT-OF-RANGE',
    badgeClass: 'oor',
    cat: 'data',
    severity: 'CRITICAL',
    title: 'Physical Impossibility',
    desc: 'Value exceeds hard physical bounds: T > 60°C, P > 1084 hPa, H > 100%. Instant CRITICAL rule alert.',
    example: 'T = 72°C at Himalayan station',
    detection: 'Hard rule: any_oor = 1 → confidence 0.95+',
    action: 'Immediate maintenance dispatch. Quarantine station data.',
    chartColor: '#e74c3c',
    generatePoints: () => {
      const pts = Array.from({ length: 30 }, (_, i) => 34 + Math.sin(i / 4) * 0.3 + (Math.random() - 0.5) * 0.1);
      pts[15] = 74;
      pts[16] = 72;
      return pts;
    }
  },
  {
    id: 'multi',
    badge: 'MULTIVARIATE',
    badgeClass: 'multi',
    cat: 'multi',
    severity: 'HIGH – CRITICAL',
    title: 'Multivariate Inconsistency',
    desc: 'Each parameter individually within range, but their combination is physically impossible (hot + humid + high pressure).',
    example: 'T=52°C + H=94% + P=1060 hPa',
    detection: 'physics_inconsistency score + IsolationForest',
    action: 'Review all sensor channels simultaneously. Check ADC circuitry.',
    chartColor: '#8250df',
    multiSeries: true,
    generatePoints: () => {
      const t = Array.from({ length: 30 }, (_, i) => 34 + Math.sin(i / 4) * 0.3);
      const h = Array.from({ length: 30 }, (_, i) => 72 + Math.sin(i / 4) * 1.0);
      t[20] = 54;
      h[20] = 96;
      return { t, h };
    }
  },
  {
    id: 'noise',
    badge: 'NOISE BURST',
    badgeClass: 'noise',
    cat: 'sensor',
    severity: 'MEDIUM',
    title: 'Noise Burst / EMI Interference',
    desc: 'High-frequency random fluctuations over a short duration. Short-window std spikes signal EMI or power noise.',
    example: 'T oscillating ±8°C for 30 min',
    detection: 's_temp_std spike + IsolationForest',
    action: 'Check cable shielding. Inspect power supply filter.',
    chartColor: '#e67e22',
    generatePoints: () => {
      const pts = Array.from({ length: 30 }, (_, i) => 34 + Math.sin(i / 4) * 0.3);
      for (let i = 12; i < 22; i++) pts[i] += (Math.random() - 0.5) * 16;
      return pts;
    }
  },
  {
    id: 'missing',
    badge: 'MISSING DATA',
    badgeClass: 'missing',
    cat: 'data',
    severity: 'HIGH',
    title: 'Communication Loss / Logger Failure',
    desc: 'NULL / NaN values indicate network failure, power outage, or data logger error. missing_flag triggers 0.95 confidence.',
    example: 'All 3 params = NULL for 1+ hour',
    detection: 'missing_flag = 1 → confidence auto-set to 0.95, severity HIGH',
    action: 'Check network, data logger power supply, SIM card.',
    chartColor: '#8b949e',
    generatePoints: () => {
      const pts = Array.from({ length: 30 }, (_, i) => 30 + Math.sin(i / 4) * 0.3);
      for (let i = 10; i < 22; i++) pts[i] = null;
      return pts;
    }
  }
];

export const DETECTION_SUMMARY_TABLE = [
  { type: 'OUT-OF-RANGE', badge: 'oor', detector: 'Physics Rule Engine', feature: 'Bounds check (min/max)', conf: '0.98 – 1.00', sev: 'CRITICAL', sevColor: '#e74c3c' },
  { type: 'MISSING DATA', badge: 'missing', detector: 'Rule Engine', feature: 'Null/NaN detector', conf: '0.95', sev: 'HIGH', sevColor: '#e67e22' },
  { type: 'SPIKE', badge: 'spike', detector: 'Rate-of-Change + IF', feature: 'temp_roc1, pres_roc1', conf: '0.85 – 0.98', sev: 'HIGH', sevColor: '#e67e22' },
  { type: 'MULTIVARIATE', badge: 'multi', detector: 'Isolation Forest + Physics', feature: 'Magnus inconsistency score', conf: '0.75 – 0.95', sev: 'HIGH', sevColor: '#e67e22' },
  { type: 'FROZEN', badge: 'frozen', detector: 'Rolling Stats + Rule', feature: 'frozen_18, unique_ratio', conf: '0.65 – 0.85', sev: 'MEDIUM', sevColor: '#f39c12' },
  { type: 'NOISE BURST', badge: 'noise', detector: 'Isolation Forest', feature: 's_temp_std, s_pres_std', conf: '0.55 – 0.75', sev: 'MEDIUM', sevColor: '#f39c12' },
  { type: 'DRIFT', badge: 'drift', detector: 'Z-Score + RandomForest', feature: 'zscore_long, rolling_bias', conf: '0.45 – 0.70', sev: 'LOW', sevColor: '#3498db' },
];
