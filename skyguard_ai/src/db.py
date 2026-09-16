"""
SkyGuard AI — MySQL Database Integration Module
Handles connection, schema initialization, bulk CSV imports, and real-time streaming ingestion.
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# Try importing mysql connector, fallback to pymysql
try:
    import mysql.connector as mysql_driver
    from mysql.connector import Error as DBError
    DRIVER_TYPE = "mysql.connector"
except ImportError:
    try:
        import pymysql as mysql_driver
        from pymysql import Error as DBError
        DRIVER_TYPE = "pymysql"
    except ImportError:
        mysql_driver = None
        DBError = Exception
        DRIVER_TYPE = None


def get_db_config():
    """Returns database configuration dictionary from environment variables."""
    return {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", 3306)),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", "Siva143sk"),
        "database": os.getenv("MYSQL_DATABASE", "skyguard_db"),
    }


def get_connection(include_db=True):
    """
    Establish a connection to MySQL server.
    If include_db=False, connects to server without selecting a specific database.
    """
    if mysql_driver is None:
        raise RuntimeError(
            "No MySQL driver found. Please run: pip install mysql-connector-python pymysql"
        )

    cfg = get_db_config()
    conn_params = {
        "host": cfg["host"],
        "port": cfg["port"],
        "user": cfg["user"],
        "password": cfg["password"],
    }
    if include_db:
        conn_params["database"] = cfg["database"]

    if DRIVER_TYPE == "mysql.connector":
        conn_params["autocommit"] = True
        return mysql_driver.connect(**conn_params)
    else:
        conn_params["autocommit"] = True
        return mysql_driver.connect(**conn_params)


def init_db():
    """Creates the database and tables if they do not exist."""
    cfg = get_db_config()
    db_name = cfg["database"]

    print(f"Connecting to MySQL server at {cfg['host']}:{cfg['port']} as '{cfg['user']}'...")
    server_conn = get_connection(include_db=False)
    server_cur = server_conn.cursor()

    server_cur.execute(
        f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    )
    server_cur.close()
    server_conn.close()
    print(f"Database `{db_name}` is ready.")

    conn = get_connection(include_db=True)
    cur = conn.cursor()

    # 1. Stations Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS `stations` (
        `station_id` VARCHAR(50) PRIMARY KEY,
        `station_name` VARCHAR(100) NOT NULL,
        `short_name` VARCHAR(50) NOT NULL,
        `latitude` DECIMAL(9, 6) NOT NULL,
        `longitude` DECIMAL(9, 6) NOT NULL,
        `coverage_km` INT DEFAULT 25,
        `status` VARCHAR(20) DEFAULT 'HEALTHY',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # 2. Raw Sensor Readings Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS `sensor_readings` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `station_id` VARCHAR(50) NOT NULL,
        `timestamp` DATETIME NOT NULL,
        `temperature` FLOAT NULL,
        `pressure` FLOAT NULL,
        `humidity` FLOAT NULL,
        `anomaly_label` TINYINT DEFAULT 0,
        `anomaly_type` VARCHAR(50) DEFAULT 'normal',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_sr_station` (`station_id`),
        INDEX `idx_sr_timestamp` (`timestamp`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # 3. Model Anomaly Detections Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS `anomaly_detections` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `station_id` VARCHAR(50) NOT NULL,
        `timestamp` DATETIME NOT NULL,
        `temperature` FLOAT NULL,
        `pressure` FLOAT NULL,
        `humidity` FLOAT NULL,
        `anomaly_flag` TINYINT DEFAULT 0,
        `confidence_score` FLOAT DEFAULT 0,
        `severity` VARCHAR(20) DEFAULT 'NORMAL',
        `root_cause` TEXT NULL,
        `rule_triggers` TEXT NULL,
        `if_score` FLOAT DEFAULT 0,
        `stat_score` FLOAT DEFAULT 0,
        `rf_score` FLOAT DEFAULT 0,
        `anomaly_label` TINYINT DEFAULT 0,
        `anomaly_type` VARCHAR(50) DEFAULT 'normal',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_ad_station` (`station_id`),
        INDEX `idx_ad_timestamp` (`timestamp`),
        INDEX `idx_ad_sev` (`severity`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # 4. Corrected Telemetry Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS `corrected_telemetry` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `station_id` VARCHAR(50) NOT NULL,
        `timestamp` DATETIME NOT NULL,
        `temperature_raw` FLOAT NULL,
        `pressure_raw` FLOAT NULL,
        `humidity_raw` FLOAT NULL,
        `anomaly_label` TINYINT DEFAULT 0,
        `anomaly_type` VARCHAR(50) DEFAULT 'normal',
        `imputed` BOOLEAN DEFAULT FALSE,
        `temperature_corrected` FLOAT NULL,
        `pressure_corrected` FLOAT NULL,
        `humidity_corrected` FLOAT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_ct_station` (`station_id`),
        INDEX `idx_ct_timestamp` (`timestamp`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # 5. Alert Logs Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS `alert_logs` (
        `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
        `timestamp` DATETIME NOT NULL,
        `station_name` VARCHAR(100) NOT NULL,
        `anomaly_type` VARCHAR(50) NOT NULL,
        `severity` VARCHAR(20) NOT NULL,
        `message` TEXT NOT NULL,
        `action_recommended` TEXT NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_al_timestamp` (`timestamp`),
        INDEX `idx_al_sev` (`severity`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    cur.close()
    conn.close()
    print("Database tables initialized successfully.")


def seed_stations():
    """Seeds the 20 Tamil Nadu weather stations."""
    stations_data = [
        ("AWS_Chennai_001", "Chennai — Nungambakkam", "Chennai", 13.0604, 80.2496, 35, "HEALTHY"),
        ("AWS_Madurai_002", "Madurai — Meenambakkam", "Madurai", 9.8327, 78.0930, 30, "HEALTHY"),
        ("AWS_Coimbatore_003", "Coimbatore — Peelamedu", "Coimbatore", 11.0300, 77.0390, 32, "HEALTHY"),
        ("AWS_Trichy_004", "Tiruchirappalli", "Trichy", 10.7905, 78.7047, 28, "HEALTHY"),
        ("AWS_Salem_005", "Salem — Fairlands", "Salem", 11.6643, 78.1460, 25, "HEALTHY"),
        ("AWS_Tirunelveli_006", "Tirunelveli", "Tirunelveli", 8.7271, 77.6954, 27, "HEALTHY"),
        ("AWS_Vellore_007", "Vellore — Katpadi", "Vellore", 12.9165, 79.1325, 24, "HEALTHY"),
        ("AWS_Erode_008", "Erode — Surampatti", "Erode", 11.3410, 77.7172, 26, "HEALTHY"),
        ("AWS_Thoothukudi_009", "Thoothukudi — Harbour", "Thoothukudi", 8.7642, 78.1348, 22, "HEALTHY"),
        ("AWS_Dindigul_010", "Dindigul — Sirumalai", "Dindigul", 10.3624, 77.9695, 23, "HEALTHY"),
        ("AWS_Kancheepuram_011", "Kancheepuram", "Kancheepuram", 12.8352, 79.7100, 22, "HEALTHY"),
        ("AWS_Thanjavur_012", "Thanjavur", "Thanjavur", 10.7870, 79.1378, 26, "HEALTHY"),
        ("AWS_Nagapattinam_013", "Nagapattinam — Coast", "Nagapattinam", 10.7672, 79.8449, 20, "HEALTHY"),
        ("AWS_Ooty_014", "Ooty — Nilgiris", "Ooty", 11.4102, 76.6950, 18, "HEALTHY"),
        ("AWS_Rameshwaram_015", "Rameshwaram — Island", "Rameshwaram", 9.2876, 79.3129, 20, "HEALTHY"),
        ("AWS_Cuddalore_016", "Cuddalore — Coastal", "Cuddalore", 11.7480, 79.7680, 22, "HEALTHY"),
        ("AWS_Puducherry_017", "Puducherry — Raj Nivas", "Puducherry", 11.9340, 79.8300, 18, "HEALTHY"),
        ("AWS_Hosur_018", "Hosur — Denkanikottai", "Hosur", 12.7409, 77.8253, 20, "HEALTHY"),
        ("AWS_Karur_019", "Karur — Pappireddipatti", "Karur", 10.9601, 78.0766, 22, "HEALTHY"),
        ("AWS_Virudhunagar_020", "Virudhunagar", "Virudhunagar", 9.5850, 77.9624, 20, "HEALTHY"),
    ]

    conn = get_connection()
    cur = conn.cursor()
    cur.executemany("""
    INSERT INTO `stations` (`station_id`, `station_name`, `short_name`, `latitude`, `longitude`, `coverage_km`, `status`)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE `station_name`=VALUES(`station_name`), `coverage_km`=VALUES(`coverage_km`);
    """, stations_data)
    cur.close()
    conn.close()
    print(f"Seeded {len(stations_data)} weather stations into MySQL.")


def import_csv_data(data_dir=None):
    """Imports existing CSV files into corresponding MySQL tables."""
    import pandas as pd
    import numpy as np

    if data_dir is None:
        data_dir = Path(__file__).resolve().parent.parent / "data"
    else:
        data_dir = Path(data_dir)

    conn = get_connection()
    cur = conn.cursor()

    # 1. Import aws_sample_data.csv -> sensor_readings
    sample_csv = data_dir / "aws_sample_data.csv"
    if sample_csv.exists():
        print(f"Reading {sample_csv.name}...")
        df = pd.read_csv(sample_csv)
        df = df.replace({np.nan: None})
        rows = []
        for _, r in df.iterrows():
            rows.append((
                str(r["station_id"]),
                str(r["timestamp"]),
                float(r["temperature"]) if r["temperature"] is not None else None,
                float(r["pressure"]) if r["pressure"] is not None else None,
                float(r["humidity"]) if r["humidity"] is not None else None,
                int(r["anomaly_label"]),
                str(r["anomaly_type"])
            ))

        # Chunked insert
        chunk_size = 1000
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            cur.executemany("""
            INSERT INTO `sensor_readings` (`station_id`, `timestamp`, `temperature`, `pressure`, `humidity`, `anomaly_label`, `anomaly_type`)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, chunk)
        print(f"Imported {len(rows)} rows into `sensor_readings`.")

    # 2. Import detection_results.csv -> anomaly_detections
    det_csv = data_dir / "detection_results.csv"
    if det_csv.exists():
        print(f"Reading {det_csv.name}...")
        df = pd.read_csv(det_csv)
        df = df.replace({np.nan: None})
        rows = []
        for _, r in df.iterrows():
            rows.append((
                str(r["station_id"]),
                str(r["timestamp"]),
                float(r["temperature"]) if r["temperature"] is not None else None,
                float(r["pressure"]) if r["pressure"] is not None else None,
                float(r["humidity"]) if r["humidity"] is not None else None,
                int(r["anomaly_flag"]),
                float(r["confidence_score"]) if r["confidence_score"] is not None else 0.0,
                str(r["severity"]),
                str(r["root_cause"]) if r["root_cause"] is not None else None,
                str(r["rule_triggers"]) if r["rule_triggers"] is not None else None,
                float(r["if_score"]) if r["if_score"] is not None else 0.0,
                float(r["stat_score"]) if r["stat_score"] is not None else 0.0,
                float(r["rf_score"]) if r["rf_score"] is not None else 0.0,
                int(r["anomaly_label"]) if "anomaly_label" in r and r["anomaly_label"] is not None else 0,
                str(r["anomaly_type"]) if "anomaly_type" in r and r["anomaly_type"] is not None else "normal",
            ))

        chunk_size = 1000
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            cur.executemany("""
            INSERT INTO `anomaly_detections` (
                `station_id`, `timestamp`, `temperature`, `pressure`, `humidity`,
                `anomaly_flag`, `confidence_score`, `severity`, `root_cause`, `rule_triggers`,
                `if_score`, `stat_score`, `rf_score`, `anomaly_label`, `anomaly_type`
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, chunk)
        print(f"Imported {len(rows)} rows into `anomaly_detections`.")

    # 3. Import corrected_data.csv -> corrected_telemetry
    corr_csv = data_dir / "corrected_data.csv"
    if corr_csv.exists():
        print(f"Reading {corr_csv.name}...")
        df = pd.read_csv(corr_csv)
        df = df.replace({np.nan: None})
        rows = []
        for _, r in df.iterrows():
            rows.append((
                str(r["station_id"]),
                str(r["timestamp"]),
                float(r["temperature"]) if r["temperature"] is not None else None,
                float(r["pressure"]) if r["pressure"] is not None else None,
                float(r["humidity"]) if r["humidity"] is not None else None,
                int(r["anomaly_label"]) if "anomaly_label" in r and r["anomaly_label"] is not None else 0,
                str(r["anomaly_type"]) if "anomaly_type" in r and r["anomaly_type"] is not None else "normal",
                bool(r["imputed"]),
                float(r["temperature_corrected"]) if r["temperature_corrected"] is not None else None,
                float(r["pressure_corrected"]) if r["pressure_corrected"] is not None else None,
                float(r["humidity_corrected"]) if r["humidity_corrected"] is not None else None,
            ))

        chunk_size = 1000
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            cur.executemany("""
            INSERT INTO `corrected_telemetry` (
                `station_id`, `timestamp`, `temperature_raw`, `pressure_raw`, `humidity_raw`,
                `anomaly_label`, `anomaly_type`, `imputed`, `temperature_corrected`, `pressure_corrected`, `humidity_corrected`
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, chunk)
        print(f"Imported {len(rows)} rows into `corrected_telemetry`.")

    # 4. Populate alert_logs from detected anomalies
    print("Generating alert logs from anomaly detections...")
    cur.execute("""
    INSERT INTO `alert_logs` (`timestamp`, `station_name`, `anomaly_type`, `severity`, `message`, `action_recommended`)
    SELECT `timestamp`, `station_id`, `anomaly_type`, `severity`,
           COALESCE(`root_cause`, CONCAT('Detected ', `anomaly_type`, ' anomaly with confidence ', ROUND(`confidence_score` * 100, 1), '%')),
           CASE `anomaly_type`
               WHEN 'spike' THEN 'Check thermocouple / RTD sensor wiring for loose connections.'
               WHEN 'frozen' THEN 'Inspect sensor transducer for mechanical blockage or icing.'
               WHEN 'drift' THEN 'Schedule recalibration against secondary reference sensor.'
               WHEN 'oor' THEN 'Quarantine sensor and dispatch maintenance crew.'
               WHEN 'multi' THEN 'Check multi-channel ADC circuitry and barometric port.'
               WHEN 'noise' THEN 'Inspect cable shielding and power supply noise filters.'
               WHEN 'missing' THEN 'Check data logger power supply and cellular SIM.'
               ELSE 'Review observation against neighbouring stations.'
           END
    FROM `anomaly_detections`
    WHERE `anomaly_flag` = 1;
    """)
    alerts_count = cur.rowcount
    print(f"Populated {alerts_count} anomaly alert events into `alert_logs`.")

    cur.close()
    conn.close()
    print("All CSV datasets successfully imported into MySQL.")


def print_table_counts():
    """Prints row counts for all tables in skyguard_db."""
    conn = get_connection()
    cur = conn.cursor()
    tables = ["stations", "sensor_readings", "anomaly_detections", "corrected_telemetry", "alert_logs"]
    print("\n--- MySQL Table Row Counts ---")
    for t in tables:
        cur.execute(f"SELECT COUNT(*) FROM `{t}`;")
        cnt = cur.fetchone()[0]
        print(f"  {t}: {cnt} rows")
    cur.close()
    conn.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--init" in args:
        init_db()
        seed_stations()
    if "--import-all" in args:
        import_csv_data()
    if "--counts" in args or len(args) == 0:
        try:
            print_table_counts()
        except Exception as e:
            print(f"Database status error: {e}")
