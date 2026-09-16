"""
SkyGuard AI — Main Entry Point
================================
Usage:
    python run.py train          # Train the model and generate evaluation outputs
    python run.py dashboard      # Launch the Plotly Dash visualization dashboard
    python run.py stream         # Run the real-time simulation stream
    python run.py generate       # Generate sample AWS data only
    python run.py db-sync        # Initialize MySQL database and import all datasets
    python run.py db-status      # Query MySQL database record counts and status
"""

import sys
import os
import argparse
import warnings

# Avoid UnicodeEncodeError on Windows terminals with cp1252 or non-UTF8 encodings
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

warnings.filterwarnings("ignore", category=UserWarning)
from pathlib import Path

# Resolve base directories safely
BASE_DIR = Path(__file__).resolve().parent
SRC      = BASE_DIR / "src"
CONFIGS  = BASE_DIR / "configs"

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
if str(CONFIGS) not in sys.path:
    sys.path.insert(0, str(CONFIGS))


def cmd_train(args=None):
    """Run full training and evaluation pipeline."""
    print("[SkyGuard] Starting training pipeline...")
    try:
        try:
            from src.train_and_evaluate import run_full_pipeline
        except ImportError:
            from train_and_evaluate import run_full_pipeline
        run_full_pipeline()
    except Exception as e:
        print(f"[SkyGuard] Error during training: {e}")
        raise


def cmd_dashboard(args=None):
    """Launch interactive Dash visualization dashboard."""
    try:
        import configs.config as cfg
    except ImportError:
        import config as cfg
    host = getattr(args, "host", None) or cfg.DASH_HOST
    port = getattr(args, "port", None) or cfg.DASH_PORT
    
    print(f"[SkyGuard] Launching dashboard at http://{host}:{port} ...")
    try:
        try:
            from src.dashboard import app
        except ImportError:
            from dashboard import app
        if hasattr(app, "run"):
            app.run(debug=False, host=host, port=port)
        elif hasattr(app, "run_server"):
            app.run_server(debug=False, host=host, port=port)
    except KeyboardInterrupt:
        print("\n[SkyGuard] Dashboard stopped by user.")
    except Exception as e:
        print(f"[SkyGuard] Error launching dashboard: {e}")
        raise


def cmd_stream(args=None):
    """Run real-time streaming simulation."""
    print("[SkyGuard] Starting real-time simulation stream...")
    try:
        from src.anomaly_detector import SkyGuardEnsemble
        from src.realtime_stream import simulate_realtime
    except ImportError:
        from anomaly_detector import SkyGuardEnsemble
        from realtime_stream import simulate_realtime
    try:
        import configs.config as cfg
    except ImportError:
        import config as cfg

    n_readings = getattr(args, "readings", 200) or 200
    delay = getattr(args, "delay", 0.05) or 0.05

    try:
        model = SkyGuardEnsemble.load()
    except (FileNotFoundError, Exception):
        print("  Model not found or invalid -- training first...")
        cmd_train()
        model = SkyGuardEnsemble.load()

    try:
        alerts, engine = simulate_realtime(model, n_readings=n_readings, delay=delay)
        print(f"\n  Total alerts generated: {len(alerts)}")
    except KeyboardInterrupt:
        print("\n[SkyGuard] Simulation interrupted by user.")
    except Exception as e:
        print(f"[SkyGuard] Error during simulation: {e}")
        raise


def cmd_generate(args=None):
    """Generate synthetic AWS sensor data."""
    print("[SkyGuard] Generating sample AWS data...")
    try:
        import configs.config as cfg
    except ImportError:
        import config as cfg
    try:
        from src.data_generator import AWSDataGenerator
    except ImportError:
        from data_generator import AWSDataGenerator

    station_id = getattr(args, "station", "AWS_Chennai_001") or "AWS_Chennai_001"
    n_hours = getattr(args, "hours", 720) or 720
    seed = getattr(args, "seed", 42) or 42

    gen = AWSDataGenerator(station_id=station_id, seed=seed)
    df = gen.generate_normal_data(n_hours=n_hours)
    df = gen.inject_anomalies(df, anomaly_fraction=cfg.ANOMALY_FRACTION)

    cfg.DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = cfg.DATA_DIR / "aws_sample_data.csv"
    df.to_csv(out, index=False)
    print(f"  Saved {len(df):,} rows -> {out}")
    if "anomaly_type" in df.columns:
        print(f"  Anomaly types:\n{df['anomaly_type'].value_counts().to_string()}")


def cmd_db_sync(args=None):
    """Initialize MySQL database schema and import dataset tables."""
    print("[SkyGuard] Initializing MySQL database and importing all datasets...")
    try:
        try:
            from src.db import init_db, seed_stations, import_csv_data, print_table_counts
        except ImportError:
            from db import init_db, seed_stations, import_csv_data, print_table_counts
        init_db()
        seed_stations()
        import_csv_data()
        print_table_counts()
    except Exception as e:
        print(f"[SkyGuard] Database sync failed: {e}")
        print("  Ensure MySQL server is running and credentials in .env or config are correct.")


def cmd_db_status(args=None):
    """Check database connection and table counts."""
    print("[SkyGuard] Querying MySQL database status...")
    try:
        try:
            from src.db import print_table_counts
        except ImportError:
            from db import print_table_counts
        print_table_counts()
    except Exception as e:
        print(f"[SkyGuard] Database query failed: {e}")
        print("  Ensure MySQL server is running and credentials in .env or config are correct.")


COMMANDS = {
    "train":     cmd_train,
    "dashboard": cmd_dashboard,
    "stream":    cmd_stream,
    "generate":  cmd_generate,
    "db-sync":   cmd_db_sync,
    "db-status": cmd_db_status,
}


def build_parser():
    parser = argparse.ArgumentParser(
        description="SkyGuard AI — Main Entry Point",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python run.py train
  python run.py dashboard --port 8050
  python run.py stream --readings 100 --delay 0.02
  python run.py generate --hours 720
  python run.py db-sync
  python run.py db-status
"""
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # train
    p_train = subparsers.add_parser("train", help="Train model and evaluate pipeline")
    p_train.set_defaults(func=cmd_train)

    # dashboard
    p_dash = subparsers.add_parser("dashboard", help="Launch Plotly Dash visualization web UI")
    p_dash.add_argument("--host", type=str, default=None, help="Host IP to bind (default: from config)")
    p_dash.add_argument("--port", type=int, default=None, help="Port to bind (default: from config)")
    p_dash.set_defaults(func=cmd_dashboard)

    # stream
    p_stream = subparsers.add_parser("stream", help="Run real-time streaming simulation")
    p_stream.add_argument("--readings", type=int, default=200, help="Number of simulation steps (default: 200)")
    p_stream.add_argument("--delay", type=float, default=0.05, help="Delay in seconds between steps (default: 0.05)")
    p_stream.set_defaults(func=cmd_stream)

    # generate
    p_gen = subparsers.add_parser("generate", help="Generate synthetic AWS sample data")
    p_gen.add_argument("--station", type=str, default="AWS_Chennai_001", help="Station identifier")
    p_gen.add_argument("--hours", type=int, default=720, help="Number of hours to generate (default: 720)")
    p_gen.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    p_gen.set_defaults(func=cmd_generate)

    # db-sync
    p_sync = subparsers.add_parser("db-sync", help="Initialize MySQL schema and seed data")
    p_sync.set_defaults(func=cmd_db_sync)

    # db-status
    p_stat = subparsers.add_parser("db-status", help="Query MySQL table counts and status")
    p_stat.set_defaults(func=cmd_db_status)

    return parser


def main():
    parser = build_parser()
    
    if len(sys.argv) < 2:
        parser.print_help()
        print(f"\nAvailable commands: {', '.join(COMMANDS.keys())}")
        sys.exit(1)

    args = parser.parse_args()
    if args.command and hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
