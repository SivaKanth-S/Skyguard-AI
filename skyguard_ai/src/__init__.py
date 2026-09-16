"""
SkyGuard AI — Public API
========================
Import the key classes directly from the src package:

    from src import SkyGuardEnsemble, AWSDataGenerator, AWSFeatureEngineer
    from src import SkyGuardRealTimeEngine, AWSImputer, SkyGuardExplainer
"""
import sys
from pathlib import Path

_SRC_DIR = str(Path(__file__).parent.resolve())
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

from .anomaly_detector import SkyGuardEnsemble, RuleBasedDetector
from .data_generator import AWSDataGenerator
from .feature_engineering import AWSFeatureEngineer
from .imputation import AWSImputer
from .explainability import SkyGuardExplainer
from .realtime_stream import SkyGuardRealTimeEngine, SensorReading, AnomalyAlert
from .db import get_connection, init_db, import_csv_data

__all__ = [
    "SkyGuardEnsemble",
    "RuleBasedDetector",
    "AWSDataGenerator",
    "AWSFeatureEngineer",
    "AWSImputer",
    "SkyGuardExplainer",
    "SkyGuardRealTimeEngine",
    "SensorReading",
    "AnomalyAlert",
]
