"""
SkyGuard AI — Main Entry Point
================================
Usage:
    python run.py train          # Train the model and generate evaluation outputs
    python run.py dashboard      # Launch the Plotly Dash visualization dashboard
    python run.py stream         # Run the real-time simulation stream
    python run.py generate       # Generate sample AWS data only
"""

import sys
import os
import warnings
warnings.filterwarnings("ignore", category=UserWarning)
from pathlib import Path

# Make src/ and configs/ importable
SRC     = Path(__file__).parent / "src"
CONFIGS = Path(__file__).parent / "configs"
sys.path.insert(0, str(SRC))
sys.path.insert(0, str(CONFIGS))


def cmd_train():
    print("[SkyGuard] Starting training pipeline...")
    from train_and_evaluate import run_full_pipeline
    run_full_pipeline()


def cmd_dashboard():
    print("[SkyGuard] Launching dashboard at http://localhost:8050 ...")
    import config as cfg
    from dashboard import app
    app.run(debug=False, host=cfg.DASH_HOST, port=cfg.DASH_PORT)


def cmd_stream():
    print("[SkyGuard] Starting real-time simulation stream...")
    from anomaly_detector import SkyGuardEnsemble
    from realtime_stream import simulate_realtime
    import config as cfg

    try:
        model = SkyGuardEnsemble.load()
    except FileNotFoundError:
        print("  Model not found — training first...")
        cmd_train()
        model = SkyGuardEnsemble.load()

    alerts, engine = simulate_realtime(model, n_readings=200, delay=0.05)
    print(f"\n  Total alerts generated: {len(alerts)}")


def cmd_generate():
    print("[SkyGuard] Generating sample AWS data...")
    import config as cfg
    from data_generator import AWSDataGenerator

    gen = AWSDataGenerator(station_id="AWS_Chennai_001", seed=42)
    df = gen.generate_normal_data(n_hours=720)
    df = gen.inject_anomalies(df, anomaly_fraction=0.04)

    cfg.DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = cfg.DATA_DIR / "aws_sample_data.csv"
    df.to_csv(out, index=False)
    print(f"  Saved {len(df):,} rows → {out}")
    print(f"  Anomaly types:\n{df['anomaly_type'].value_counts().to_string()}")


COMMANDS = {
    "train":     cmd_train,
    "dashboard": cmd_dashboard,
    "stream":    cmd_stream,
    "generate":  cmd_generate,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        print("Available commands:", ", ".join(COMMANDS))
        sys.exit(1)
    COMMANDS[sys.argv[1]]()
