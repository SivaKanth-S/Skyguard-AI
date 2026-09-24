export const METRICS_KPIS = [
  { val: '93%', lbl: 'Precision', sub: 'Low false alarm rate', color: '#3498db' },
  { val: '96%', lbl: 'Recall', sub: 'Misses only 4% of faults', color: '#2ecc71' },
  { val: '94%', lbl: 'F1 Score', sub: 'Harmonic mean', color: '#e74c3c' },
  { val: '98%', lbl: 'ROC-AUC', sub: 'Near-perfect separation', color: '#9b59b6' },
  { val: '97%', lbl: 'Accuracy', sub: 'Overall detection', color: '#f39c12' },
];

export const RADAR_DATA = {
  labels: ['Accuracy', 'Precision', 'Recall', 'ROC-AUC', 'Real-Time', 'Explainability', 'Scalability', 'Energy'],
  skyguard: [97, 93, 96, 98, 92, 90, 88, 85],
  baseline: [72, 65, 78, 70, 95, 45, 70, 90]
};

export const BAR_COMPARISON_DATA = {
  labels: ['Precision', 'Recall', 'F1', 'ROC-AUC', 'Accuracy'],
  skyguard: [93, 96, 94, 98, 97],
  baseline: [65, 78, 71, 70, 72]
};

export const DETAILED_SCORES = [
  { name: 'Precision', val: 93, color: '#3498db' },
  { name: 'Recall', val: 96, color: '#2ecc71' },
  { name: 'F1 Score', val: 94, color: '#e74c3c' },
  { name: 'ROC-AUC', val: 98, color: '#9b59b6' },
  { name: 'Detection Accuracy', val: 97, color: '#f39c12' },
  { name: 'False Alarm Rate ↓', val: 4, color: '#e67e22' },
];

export const PER_TYPE_DETECTION = [
  { type: 'OUT-OF-RANGE', badge: 'oor', prec: '100%', rec: '100%', f1: '100%', conf: '97.2%' },
  { type: 'MISSING', badge: 'missing', prec: '100%', rec: '100%', f1: '100%', conf: '95.0%' },
  { type: 'SPIKE', badge: 'spike', prec: '98%', rec: '97%', f1: '97.5%', conf: '91.4%' },
  { type: 'MULTIVARIATE', badge: 'multi', prec: '91%', rec: '94%', f1: '92.5%', conf: '82.3%' },
  { type: 'FROZEN', badge: 'frozen', prec: '88%', rec: '93%', f1: '90.4%', conf: '68.7%' },
  { type: 'NOISE', badge: 'noise', prec: '84%', rec: '89%', f1: '86.4%', conf: '61.2%' },
  { type: 'DRIFT', badge: 'drift', prec: '79%', rec: '85%', f1: '81.9%', conf: '54.8%' },
];

export const EVALUATION_CRITERIA = [
  { wt: '25%', name: 'Innovation & Novelty', desc: 'Hybrid 4-model ensemble + physics rules + SHAP explainability + self-healing imputation — novel combination not seen in standard AWS QC tools.', score: 'Excellent', scoreClass: 'ex' },
  { wt: '20%', name: 'Detection Accuracy', desc: '97.4% overall accuracy, 98% ROC-AUC on injected test set. Out-of-range and missing data: 100% recall.', score: '97.4% — Excellent', scoreClass: 'ex' },
  { wt: '15%', name: 'Real-Time Capability', desc: 'Streaming pipeline with thread-safe per-station buffers. <5ms inference per reading. Handles 100+ concurrent stations.', score: 'Excellent', scoreClass: 'ex' },
  { wt: '10%', name: 'Explainability', desc: 'SHAP TreeExplainer values per alert + rule trigger text + human-readable root cause + recommended action.', score: 'Full SHAP — Excellent', scoreClass: 'ex' },
  { wt: '10%', name: 'Scalability', desc: 'Per-station StationBuffer, thread-safe engine, multi-station entry point in run.py. Tested on concurrent stations.', score: 'Good', scoreClass: 'gd' },
  { wt: '10%', name: 'Practical Deployability', desc: 'Single pip install, no GPU, runs on Raspberry Pi 4 (4 GB). ESP32 edge variant via rule-engine MicroPython.', score: 'Excellent', scoreClass: 'ex' },
  { wt: '5%', name: 'Visualization / UI', desc: 'Plotly Dash backend dashboard + modern responsive React web app with live maps, animated sensor feed, and alert panel.', score: 'Excellent', scoreClass: 'ex' },
  { wt: '5%', name: 'Energy Efficiency', desc: 'CPU-only inference. Rule engine runs on ESP32 (240 MHz, 320 KB RAM). Full model on Raspberry Pi at <2 W extra draw.', score: 'Good', scoreClass: 'gd' },
];

export const TEST_SUITE = [
  { title: 'TestAWSDataGenerator — 6 tests', items: 'shape · temperature bounds · pressure bounds · humidity bounds · anomaly labels · anomaly types' },
  { title: 'TestAWSFeatureEngineer — 7 tests', items: 'column count · no inf · no nan · z-score cols · physics cols · temporal · frozen' },
  { title: 'TestRuleBasedDetector — 4 tests', items: 'out-of-range temp · impossible hot/humid · normal reading passes · spike detected' },
  { title: 'TestSkyGuardEnsemble — 7 tests', items: 'feature names · returns DataFrame · required cols · confidence range · severity values · detects anomalies · evaluate metrics' },
  { title: 'TestAWSImputer — 3 tests', items: 'fills anomalous rows · leaves normal unchanged · corrected values finite' },
  { title: 'TestLiveStreamPipeline — 3 tests', items: '100 observations streaming · buffer rollover at 144 · alert triggers on injected spike' },
];
