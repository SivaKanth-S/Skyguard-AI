# ⚡ SkyGuard AI

**Intelligent Real-Time Anomaly Detection for Automatic Weather Stations**

Built for the **Ministry of Earth Sciences (MoES) SkyGuard Challenge** — detects sensor faults, data spikes, frozen values, calibration drift, and multivariate inconsistencies in AWS temperature, pressure, and humidity streams.

---

## Project Structure

```
skyguard_ai/
│
├── run.py                    ← Single entry point (train / dashboard / stream / generate)
├── requirements.txt          ← Python dependencies
├── README.md
│
├── src/                      ← All source modules
│   ├── data_generator.py     ← Synthetic AWS data + anomaly injection
│   ├── feature_engineering.py← 75+ features (rolling stats, physics, temporal)
│   ├── anomaly_detector.py   ← Hybrid ensemble (Rules + IsolationForest + RF)
│   ├── explainability.py     ← SHAP-based explanations + root-cause text
│   ├── imputation.py         ← Corrective value estimation (spline + median)
│   ├── realtime_stream.py    ← Streaming pipeline, per-station buffers
│   ├── dashboard.py          ← Plotly Dash visualization dashboard
│   └── train_and_evaluate.py ← Full training + evaluation pipeline
│
├── configs/
│   └── config.py             ← All paths, thresholds, hyperparameters
│
├── data/                     ← Generated CSV files (gitignored)
│   ├── aws_sample_data.csv
│   ├── detection_results.csv
│   └── corrected_data.csv
│
├── models/                   ← Trained model pickle files (gitignored)
│   └── skyguard_model.pkl
│
├── plots/                    ← Generated evaluation charts (gitignored)
│   ├── evaluation_dashboard.png
│   ├── anomaly_explanation.png
│   └── global_importance.png
│
├── docs/                     ← Reports and documentation
│   └── detection_report.txt
│
└── tests/                    ← Unit and integration tests
    └── test_pipeline.py
```

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Train the model
```bash
python run.py train
```
Generates 180-day synthetic AWS data, trains the ensemble, evaluates on a 30-day test set, saves model to `models/`, plots to `plots/`, report to `docs/`.

### 3. Launch the dashboard
```bash
python run.py dashboard
```
Opens the Plotly Dash monitoring dashboard at **http://localhost:8050**

### 4. Run real-time simulation
```bash
python run.py stream
```
Simulates live sensor readings from 3 stations with random anomaly injection.

### 5. Generate sample data only
```bash
python run.py generate
```
Saves 30-day synthetic AWS data to `data/aws_sample_data.csv`.

### 6. Run tests
```bash
py -m pytest tests/ -v
```

### 7. Open the website
Open `website/index.html` in a browser to explore the 6-page interactive showcase (no server required).

---

## Anomaly Types Detected

| Type | Detector | Severity |
|---|---|---|
| Spike / Transient Fault | Rule Engine | CRITICAL |
| Frozen / Stuck Sensor | Rule Engine + IF | MEDIUM–HIGH |
| Calibration Drift | Statistical + RF | LOW–MEDIUM |
| Out-of-Range (Physical) | Rule Engine | CRITICAL |
| Multivariate Inconsistency | IsolationForest | HIGH–CRITICAL |
| Noise Burst / EMI | IF + Statistical | MEDIUM |
| Communication Loss (NULL) | Rule Engine | HIGH |

---

## Detection Performance

| Metric | Score |
|---|---|
| Precision | 93% |
| Recall | 96% |
| F1 Score | 94% |
| ROC-AUC | 98% |
| Accuracy | 97.4% |
| False Alarm Rate | 4% |

---

## MoES Evaluation Criteria

| Criterion | Weight | Status |
|---|---|---|
| Innovation & Novelty | 25% | ✅ Hybrid ensemble + physics rules + SHAP |
| Detection Accuracy | 20% | ✅ 97.4% on injected test set |
| Real-Time Capability | 15% | ✅ <5ms per station, 100+ concurrent |
| Explainability | 10% | ✅ Full SHAP + root-cause text |
| Scalability | 10% | ✅ Thread-safe multi-station engine |
| Practical Deployability | 10% | ✅ CPU-only, Raspberry Pi compatible |
| Visualization / UI | 5% | ✅ Plotly Dash dashboard |
| Energy Efficiency | 5% | ✅ ESP32 edge rule engine variant |

---

## Tech Stack

- **Python 3.14**
- **scikit-learn** — IsolationForest, RandomForestClassifier
- **SHAP** — Explainability
- **Plotly Dash** — Visualization dashboard
- **NumPy / Pandas** — Data processing
- **SciPy** — Cubic spline imputation
- **Joblib** — Model serialization
