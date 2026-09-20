# ⚡ SkyGuard AI

**Real-Time Anomaly Detection, Explainability & Self-Healing for Automatic Weather Stations (AWS)**

SkyGuard AI is an end-to-end machine-learning system for detecting faulty, inconsistent, missing, or physically implausible observations from Automatic Weather Stations. It combines physics-based rules, statistical detection, unsupervised machine learning, supervised classification, explainability, corrective-value estimation, real-time streaming, visualization, and optional MySQL persistence.

> **Project purpose:** improve the reliability of meteorological sensor data before it is used for forecasting, agriculture, aviation, flood monitoring, power-grid operations, climate analysis, or disaster-management workflows.

---

## ✨ Highlights

- 🌡️ Monitors **temperature, pressure, and humidity**
- 🚨 Detects **7 major anomaly patterns**
- 🧠 Hybrid detection using:
  - Physics/rule engine
  - Rolling statistical / Z-score detection
  - Isolation Forest
  - Random Forest classifier
- 🔎 Produces anomaly confidence, severity, triggered rules, and root-cause explanations
- 🩹 Estimates corrected sensor values using interpolation, cubic splines, and rolling statistics
- 📡 Includes a multi-station real-time streaming simulator
- 📊 Includes a Plotly Dash analytics dashboard
- 🌐 Includes a React + Vite web showcase with Chart.js and Leaflet
- 🗄️ Includes optional MySQL schema, seeding, CSV import, and status commands
- 🧪 Includes automated pipeline tests
- 💻 Designed to run on CPU without requiring a GPU

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────────┐
                    │ Automatic Weather       │
                    │ Station Observations    │
                    │ T / P / H               │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Data Ingestion /         │
                    │ Synthetic Generator      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Feature Engineering      │
                    │ • Rolling statistics     │
                    │ • Rate of change         │
                    │ • Z-scores               │
                    │ • Frozen-value features  │
                    │ • Physics features      │
                    │ • Temporal features      │
                    └────────────┬────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │        SkyGuard Ensemble              │
              │                                      │
              │  Rule Engine ───────┐               │
              │  Statistical/Z-score├──► Fusion     │
              │  Isolation Forest ──┤               │
              │  Random Forest ─────┘               │
              └──────────────────┬───────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
             Anomaly Alert              Explainability
             Severity/Score             SHAP / Importance
                    │
                    ▼
             Corrected Values
             / Imputation
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
     Dash Dashboard      MySQL / CSV

                    ┌─────────────────────────┐
                    │ React Web Application   │
                    │ Dashboard / Analysis /  │
                    │ Maps / Metrics / Cases  │
                    └─────────────────────────┘
```

---

## 📁 Project Structure

```text
Skyguard-AI-main/
└── skyguard_ai/
    ├── run.py
    ├── requirements.txt
    ├── README.md
    │
    ├── configs/
    │   ├── __init__.py
    │   └── config.py
    │
    ├── src/
    │   ├── __init__.py
    │   ├── anomaly_detector.py
    │   ├── dashboard.py
    │   ├── data_generator.py
    │   ├── db.py
    │   ├── explainability.py
    │   ├── feature_engineering.py
    │   ├── imputation.py
    │   ├── realtime_stream.py
    │   └── train_and_evaluate.py
    │
    ├── tests/
    │   └── test_pipeline.py
    │
    ├── website-react/
    │   ├── package.json
    │   ├── vite.config.js
    │   ├── public/
    │   └── src/
    │       ├── App.jsx
    │       ├── components/
    │       ├── context/
    │       ├── data/
    │       ├── pages/
    │       └── styles/
    │
    ├── data/       # generated/runtime data
    ├── models/     # trained model artifacts
    ├── plots/      # generated charts
    └── docs/       # generated reports
```

---

## 🔬 Anomaly Types

SkyGuard's synthetic data generator and detection pipeline support these anomaly categories:

| Anomaly | Description | Typical Detection Signals |
|---|---|---|
| **Spike** | Sudden extreme change in a sensor reading | Rate-of-change, rules, statistical score |
| **Frozen Value** | Sensor remains constant for an abnormal period | Rolling variability / unique-value ratio |
| **Calibration Drift** | Gradual movement away from the expected signal | Trend, rolling statistics, ML |
| **Out-of-Range** | Reading violates configured physical bounds | Hard physical rules |
| **Noise Burst** | Short period of unusually high noise | Statistical + Isolation Forest |
| **Missing Data** | Sensor communication/data loss | Missing-value flags |
| **Multivariate Inconsistency** | Temperature, pressure and humidity form an implausible combination | Physics features + Isolation Forest |

Configured physical bounds are:

```text
Temperature : -20°C to 60°C
Pressure    : 870 hPa to 1084 hPa
Humidity    : 0% to 100%
```

These limits are configuration values for this project and should be reviewed before deployment with real station specifications.

---

## 🧠 Detection Pipeline

### 1. Rule-based detection

Fast, interpretable checks identify obvious failures such as:

- Physical limit violations
- Extremely large temperature/pressure changes
- Extreme rolling Z-scores
- Frozen sensor values
- Implausible temperature/humidity combinations

### 2. Statistical detection

Rolling statistics are used to identify deviations from recent behavior. The statistical detector calculates normalized anomaly scores using rolling means and standard deviations.

### 3. Isolation Forest

Isolation Forest provides multivariate unsupervised anomaly detection over the engineered feature space.

### 4. Random Forest

A supervised Random Forest component can learn from labeled anomaly examples generated by the training pipeline.

### 5. Ensemble fusion

The `SkyGuardEnsemble` combines detector outputs into a final anomaly decision and confidence/severity representation.

---

## 🧩 Feature Engineering

`AWSFeatureEngineer` creates temporal, statistical, and physics-inspired features.

Examples include:

- Rolling mean
- Rolling standard deviation
- Rolling minimum / maximum
- Rolling range
- 10-minute rate of change
- 30-minute change
- 1-hour change
- Acceleration
- Frozen-value counts
- Unique-value ratio
- Short/medium/long-window Z-scores
- Saturation vapor pressure
- Actual vapor pressure
- Dew point
- Dew-point depression
- Heat index
- Pressure deviation from a 24-hour average
- Physical out-of-range flags
- Missing-data flags
- Hour/month/day cyclic encodings
- Temperature-pressure-humidity consistency features

The default windows are based on 10-minute observations:

```text
Short   = 6 readings   ≈ 1 hour
Medium  = 18 readings  ≈ 3 hours
Long    = 72 readings  ≈ 12 hours
Buffer  = 144 readings ≈ 24 hours
```

---

## 🧪 Synthetic Data Generation

The project includes `AWSDataGenerator`, which creates realistic-looking AWS time-series data with:

- Seasonal baselines
- Diurnal cycles
- Temporal continuity
- Sensor noise
- Physical bounds
- Configurable anomaly injection

Example:

```python
from src.data_generator import AWSDataGenerator

generator = AWSDataGenerator(
    station_id="AWS_Chennai_001",
    seed=42
)

df = generator.generate_normal_data(
    n_hours=720,
    freq_minutes=10
)

df = generator.inject_anomalies(
    df,
    anomaly_fraction=0.04
)

df.to_csv("data/aws_sample_data.csv", index=False)
```

The included training configuration uses a 4% injected anomaly fraction.

> Synthetic benchmark results should not be interpreted as production performance on real AWS networks. Real deployment requires validation against representative, independently labeled station data.

---

# 🚀 Quick Start

## 1. Requirements

Recommended environment:

- Python 3.10+
- Node.js 18+ for the React application
- npm
- Optional: MySQL 8.x or compatible MySQL server

The Python dependencies are listed in:

```text
skyguard_ai/requirements.txt
```

---

## 2. Install Python Dependencies

From the `skyguard_ai` directory:

```bash
cd skyguard_ai
python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Linux / macOS

```bash
source .venv/bin/activate
```

Then:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Train and Evaluate the Model

```bash
python run.py train
```

The training pipeline:

1. Generates synthetic training data
2. Generates a separate synthetic test set
3. Engineers features
4. Trains the SkyGuard ensemble
5. Evaluates detection performance
6. Saves detection results
7. Saves the trained model
8. Generates evaluation plots
9. Generates explainability outputs/reports

Default training/test configuration:

```text
Training period : 180 days
Test period     : 30 days
Sampling        : 10 minutes
Anomaly fraction: 4%
```

Generated artifacts are written under:

```text
data/
models/
plots/
docs/
```

---

## 4. Generate Sample Data Only

```bash
python run.py generate
```

Useful options:

```bash
python run.py generate --hours 720
python run.py generate --hours 168 --station AWS_Test_001
python run.py generate --hours 720 --seed 123
```

---

## 5. Run the Real-Time Simulation

First ensure a trained model exists:

```bash
python run.py train
```

Then:

```bash
python run.py stream
```

Customize the simulation:

```bash
python run.py stream --readings 100 --delay 0.02
```

The simulator processes readings for multiple simulated stations and maintains per-station rolling buffers.

Example station IDs used by the simulator include:

```text
AWS_Chennai_001
AWS_Mumbai_002
AWS_Delhi_003
```

---

# 📊 Plotly Dash Dashboard

Launch:

```bash
python run.py dashboard
```

Default address:

```text
http://localhost:8050
```

You can change the host/port:

```bash
python run.py dashboard --host 0.0.0.0 --port 8050
```

The dashboard provides interactive monitoring and visualization of sensor/anomaly information.

---

# 🌐 React Web Application

The repository also contains a separate React/Vite web interface under:

```text
website-react/
```

Install dependencies:

```bash
cd website-react
npm install
```

Start the development server:

```bash
npm run dev
```

The Vite development server normally runs on:

```text
http://localhost:5173/
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

### Web application sections

The React application currently contains:

| Route | Purpose |
|---|---|
| `/` | Project overview and feature showcase |
| `/dashboard` | Monitoring dashboard |
| `/analysis` | Analysis / detection views |
| `/anomalies` | Supported anomaly patterns |
| `/architecture` | System architecture and model overview |
| `/usecases` | Sector/application use cases |
| `/metrics` | Evaluation metrics and comparisons |
| `/location` | Location and threat-proximity visualization |

The frontend uses React, React Router, Chart.js, Leaflet, and Lucide React.

---

# 🗄️ MySQL Integration

The project includes an optional MySQL integration in:

```text
src/db.py
```

Supported operations from the main entry point:

```bash
python run.py db-sync
python run.py db-status
```

`db-sync` initializes the database schema, seeds station information, imports available datasets, and reports table counts.

The database layer contains tables for concepts such as:

- Stations
- Raw sensor readings
- Anomaly detections
- Corrected/imputed values

## Database configuration

Use environment variables rather than committing credentials:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=skyguard_db
```

> **Security:** never commit real database passwords, API keys, tokens, or other secrets to Git. If credentials have ever been committed to a repository, rotate them.

The project may require an additional MySQL driver depending on your environment, such as `mysql-connector-python` or `pymysql`, as referenced by `src/db.py`.

---

# 🧪 Testing

Run the Python test suite:

```bash
python -m pytest tests/ -v
```

The tests cover the core pipeline and help verify data generation, feature engineering, detection, and related behavior.

For a clean development workflow, run tests after changing:

```text
src/data_generator.py
src/feature_engineering.py
src/anomaly_detector.py
src/imputation.py
src/realtime_stream.py
```

---

# ⚙️ Configuration

Central configuration is located in:

```text
configs/config.py
```

Important settings include:

```python
BOUNDS
SEVERITY_THRESHOLDS
SHORT_WINDOW
MEDIUM_WINDOW
LONG_WINDOW
IF_CONTAMINATION
IF_N_ESTIMATORS
RF_N_ESTIMATORS
RF_MAX_DEPTH
RANDOM_STATE
BUFFER_SIZE
MIN_CONFIDENCE_TO_ALERT
DASH_HOST
DASH_PORT
TRAIN_HOURS
TEST_HOURS
ANOMALY_FRACTION
DATA_FREQ_MINUTES
```

This keeps model, detection, streaming, and dashboard settings in one place.

---

# 📦 Output Artifacts

Depending on the command and pipeline stage, SkyGuard can generate:

```text
data/aws_sample_data.csv
data/detection_results.csv
data/corrected_data.csv

models/skyguard_model.pkl

plots/evaluation_dashboard.png
plots/anomaly_explanation.png
plots/global_importance.png

docs/detection_report.txt
```

Runtime/generated files should generally remain outside source control.

---

# 🔎 Explainability

The explainability module is implemented in:

```text
src/explainability.py
```

It uses SHAP when available for the Random Forest component and falls back to feature-importance-based explanations when SHAP cannot be used.

Explanations can include factors such as:

- Current sensor value
- Recent deviation
- Rate of change
- Frozen-value behavior
- Physical inconsistency
- Missing-data indicators
- Pressure deviation
- Other engineered features

The objective is to answer:

> **Why did the system flag this observation?**

rather than returning only a binary anomaly label.

---

# 🩹 Corrective / Self-Healing Pipeline

`src/imputation.py` provides estimated corrected values for anomalous observations.

The correction strategy uses:

1. Linear interpolation for short gaps
2. Cubic spline interpolation for longer gaps
3. Rolling median as a fallback

The output can include:

```text
temperature_corrected
pressure_corrected
humidity_corrected
imputed
```

These values are **estimates**, not ground truth measurements. Any operational system should preserve the original observation and clearly distinguish measured data from corrected/imputed data.

---

# 📡 Real-Time Processing

`src/realtime_stream.py` implements:

- `SensorReading`
- `AnomalyAlert`
- Per-station rolling buffers
- Streaming feature computation
- Model inference
- Alert generation
- Station health summaries
- System-level health summaries

A typical alert contains information such as:

```text
Station
Observation timestamp
Temperature
Pressure
Humidity
Severity
Confidence
Root cause
Triggered rules
Corrected values
Recommended action
```

This architecture can be adapted from simulation to a real message broker, HTTP ingestion service, MQTT stream, Kafka topic, or direct AWS gateway feed.

---

# 🛠️ Development Workflow

A typical development cycle is:

```text
1. Generate or ingest data
        ↓
2. Engineer features
        ↓
3. Train / update model
        ↓
4. Evaluate on held-out data
        ↓
5. Inspect explainability
        ↓
6. Run streaming simulation
        ↓
7. Validate dashboard/UI
        ↓
8. Run automated tests
        ↓
9. Integrate persistent storage
        ↓
10. Deploy with monitoring
```

---

# 📈 Evaluation Metrics

The project UI and existing project documentation contain benchmark figures such as:

- Accuracy: **97.4%**
- Precision: **93%**
- Recall: **96%**
- F1: **94%**
- ROC-AUC: **98%**
- False alarm rate: **4%**

These figures are associated with the project's synthetic/injected anomaly evaluation setup. They should be treated as **project benchmark results**, not as independently validated real-world production accuracy.

For a production evaluation, use:

- Real labeled AWS failures
- Station-specific calibration events
- Cross-station validation
- Time-based holdout periods
- False-positive rate per station/day
- Detection latency
- Missed-fault rate
- Calibration/generalization tests
- Robustness to missing data and sensor replacement

---

# 🧱 Technology Stack

## Backend / ML

- Python
- NumPy
- Pandas
- SciPy
- scikit-learn
- SHAP
- Joblib
- Matplotlib
- Plotly
- Dash
- Dash Bootstrap Components

## Frontend

- React
- Vite
- React Router
- Chart.js
- Leaflet
- Lucide React

## Storage

- CSV
- Optional MySQL

---

# 🔐 Security & Production Notes

Before deploying this system with real data:

- Remove hard-coded credentials and secrets.
- Store secrets in environment variables or a secrets manager.
- Do not expose MySQL directly to the public internet.
- Add authentication and authorization to dashboards/APIs.
- Validate and sanitize external sensor input.
- Keep original sensor readings immutable.
- Record model version with every anomaly decision.
- Log alert generation and corrective actions.
- Add monitoring for model drift.
- Retrain using representative real-world labels.
- Use HTTPS for remote dashboards/services.
- Add rate limits and input-size limits to public endpoints.

---

# 🚀 Production Deployment Roadmap

A production architecture could replace the current simulation layer with:

```text
AWS / Sensor Gateway
        │
        ▼
MQTT / Kafka / HTTP Ingestion
        │
        ▼
Message Queue / Stream Processor
        │
        ▼
SkyGuard Feature Engine
        │
        ├──────────────► Rule Engine
        ├──────────────► Statistical Detector
        ├──────────────► Isolation Forest
        └──────────────► Random Forest
                         │
                         ▼
                  Ensemble Decision
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
          Alerts     Corrected    Database
                       Values
             │
             ▼
       Dashboard / API / Notifications
```

Potential deployment targets include a local server, cloud VM, containerized service, edge computer, or an appropriately sized IoT gateway.

---

# 🧭 Limitations

SkyGuard AI is currently a project/prototype implementation rather than a certified meteorological data-quality system.

Important limitations include:

1. The benchmark pipeline uses synthetic data and injected anomalies.
2. Synthetic anomaly distributions may not match real sensor failures.
3. Physics thresholds are generic configuration values.
4. The React application is primarily a web showcase/visualization layer rather than a complete production API client.
5. Real-time processing is demonstrated through simulation.
6. MySQL integration is optional.
7. Corrected values are estimates and require domain validation before operational use.
8. Model performance can change substantially when applied to new station types, climates, sensors, sampling intervals, or failure modes.

---

# 🤝 Contributing

1. Fork or copy the project.
2. Create a feature branch:

```bash
git checkout -b feature/my-change
```

3. Make your changes.
4. Run tests:

```bash
python -m pytest tests/ -v
```

5. Check the frontend:

```bash
cd website-react
npm run lint
npm run build
```

6. Commit your changes:

```bash
git add .
git commit -m "Add my change"
```

7. Push and open a pull request.

When contributing ML changes, include the dataset/evaluation setup and explain how the change affects false positives, false negatives, latency, and interpretability.

---

# 📄 License

No explicit license file was identified in the supplied project archive.

If this project will be distributed publicly, add an appropriate `LICENSE` file and update this section with the selected license and attribution requirements.

---

# 👥 Project

**SkyGuard AI**

> Intelligent Real-Time Anomaly Detection for Automatic Weather Stations

Core goals:

**Detect → Explain → Correct → Monitor**

