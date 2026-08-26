"""
SkyGuard AI — Central Configuration
All paths, thresholds, and hyperparameters live here.
"""
from pathlib import Path

# ─── Root paths ───────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parent.parent   # skyguard_ai/
SRC_DIR     = ROOT / "src"
DATA_DIR    = ROOT / "data"
MODELS_DIR  = ROOT / "models"
PLOTS_DIR   = ROOT / "plots"
DOCS_DIR    = ROOT / "docs"

# ─── Data files ───────────────────────────────────────────────
SAMPLE_DATA_CSV     = DATA_DIR / "aws_sample_data.csv"
DETECTION_RESULTS   = DATA_DIR / "detection_results.csv"
CORRECTED_DATA_CSV  = DATA_DIR / "corrected_data.csv"
DETECTION_REPORT    = DOCS_DIR / "detection_report.txt"

# ─── Model files ──────────────────────────────────────────────
MODEL_PATH          = MODELS_DIR / "skyguard_model.pkl"

# ─── AWS physical bounds ──────────────────────────────────────
BOUNDS = {
    "temperature": (-20.0, 60.0),    # °C
    "pressure":    (870.0, 1084.0),  # hPa
    "humidity":    (0.0,   100.0),   # %
}

# ─── Anomaly thresholds ───────────────────────────────────────
SEVERITY_THRESHOLDS = {
    "CRITICAL": 0.85,
    "HIGH":     0.65,
    "MEDIUM":   0.45,
    "LOW":      0.25,
}

# ─── Feature engineering windows (10-min intervals) ──────────
SHORT_WINDOW  = 6    # 1 hour
MEDIUM_WINDOW = 18   # 3 hours
LONG_WINDOW   = 72   # 12 hours

# ─── Model hyperparameters ────────────────────────────────────
IF_CONTAMINATION  = 0.04
IF_N_ESTIMATORS   = 200
RF_N_ESTIMATORS   = 300
RF_MAX_DEPTH      = 12
RANDOM_STATE      = 42

# ─── Streaming ────────────────────────────────────────────────
BUFFER_SIZE             = 144   # 24 hours at 10-min intervals
MIN_CONFIDENCE_TO_ALERT = 0.25

# ─── Dashboard ────────────────────────────────────────────────
DASH_HOST = "0.0.0.0"
DASH_PORT = 8050

# ─── Training data ────────────────────────────────────────────
TRAIN_HOURS         = 4320   # 180 days
TEST_HOURS          = 720    # 30 days
ANOMALY_FRACTION    = 0.04   # 4% contamination
DATA_FREQ_MINUTES   = 10
