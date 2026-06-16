import os
import sys
from dotenv import load_dotenv

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import snowflake.connector

load_dotenv()

SOURCE_TABLE = "DATASENSE_DB.PUBLIC.GOLD_ANOMALY_FEATURES"
RESULT_TABLE = "DATASENSE_DB.PUBLIC.ANOMALY_RESULTS"

ISOLATION_FEATURES = [
    "revenue_zscore",
    "revenue_dod_change_pct",
    "total_orders",
    "unique_customers",
]

CREATE_RESULT_TABLE = f"""
CREATE TABLE IF NOT EXISTS {RESULT_TABLE} (
    sale_date             DATE,
    total_revenue         FLOAT,
    revenue_zscore        FLOAT,
    anomaly_type          VARCHAR,
    detection_method      VARCHAR,
    top_product_that_day  VARCHAR,
    is_weekend            BOOLEAN,
    created_at            TIMESTAMP DEFAULT current_timestamp()
)
"""
TRUNCATE_RESULT = f"TRUNCATE TABLE {RESULT_TABLE}"

INSERT_RESULT = f"""
INSERT INTO {RESULT_TABLE}
    (sale_date, total_revenue, revenue_zscore, anomaly_type,
     detection_method, top_product_that_day, is_weekend)
VALUES (%s, %s, %s, %s, %s, %s, %s)
"""


def get_connection():
    return snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        role=os.getenv("SNOWFLAKE_ROLE"),
        database=os.getenv("SNOWFLAKE_DATABASE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA"),
    )


def fetch_features(cur) -> pd.DataFrame:
    cur.execute(f"SELECT * FROM {SOURCE_TABLE} ORDER BY SALE_DATE")
    cols = [d[0].lower() for d in cur.description]
    rows = cur.fetchall()
    return pd.DataFrame(rows, columns=cols)


def statistical_flags(df: pd.DataFrame) -> pd.Series:
    """Flag rows where |revenue_zscore| > 2.5."""
    return df["revenue_zscore"].abs() > 2.5


def isolation_forest_flags(df: pd.DataFrame) -> pd.Series:
    """Flag rows marked as outliers (-1) by IsolationForest."""
    X = df[ISOLATION_FEATURES].copy()
    # Impute NaN (e.g. first-row DoD is NaN) with column median
    X = X.fillna(X.median(numeric_only=True))

    model = IsolationForest(contamination=0.05, random_state=42)
    preds = model.fit_predict(X)
    return pd.Series(preds == -1, index=df.index)


def combine_signals(stat: pd.Series, ml: pd.Series) -> pd.Series:
    both  = stat & ml
    either = stat | ml
    result = pd.Series("normal", index=stat.index)
    result[either]  = "possible_anomaly"
    result[both]    = "confirmed_anomaly"
    return result


def build_result_rows(df: pd.DataFrame, detection: pd.Series) -> list:
    rows = []
    for _, row in df.iterrows():
        rows.append((
            row["sale_date"],
            float(row["total_revenue"])     if pd.notna(row["total_revenue"])    else None,
            float(row["revenue_zscore"])    if pd.notna(row["revenue_zscore"])   else None,
            row["anomaly_type"],
            detection[row.name],
            row.get("top_product_that_day"),
            bool(row["is_weekend"])         if pd.notna(row["is_weekend"])       else None,
        ))
    return rows


def print_summary(detection: pd.Series) -> None:
    counts = detection.value_counts()
    confirmed = counts.get("confirmed_anomaly", 0)
    possible  = counts.get("possible_anomaly",  0)
    normal    = counts.get("normal",             0)
    print(f"\n{'='*40}")
    print("  ANOMALY DETECTION SUMMARY")
    print(f"{'='*40}")
    print(f"  Confirmed anomalies : {confirmed}")
    print(f"  Possible anomalies  : {possible}")
    print(f"  Normal days         : {normal}")
    print(f"{'='*40}\n")


def main():
    try:
        conn = get_connection()
        cur  = conn.cursor()
    except Exception as exc:
        print(f"FAILURE: Could not connect to Snowflake — {exc}")
        sys.exit(1)

    # ── Fetch gold features ───────────────────────────────────────────────────
    print("Fetching gold_anomaly_features from Snowflake...")
    df = fetch_features(cur)
    if df.empty:
        print("FAILURE: gold_anomaly_features returned 0 rows.")
        cur.close(); conn.close(); sys.exit(1)
    print(f"  {len(df)} date rows loaded.\n")

    # ── Detection methods ─────────────────────────────────────────────────────
    print("Running Method 1 — Statistical (|z-score| > 2.5)...")
    stat_flags = statistical_flags(df)
    print(f"  {stat_flags.sum()} rows flagged.\n")

    print("Running Method 2 — IsolationForest (contamination=0.05)...")
    ml_flags = isolation_forest_flags(df)
    print(f"  {ml_flags.sum()} rows flagged.\n")

    # ── Combine ───────────────────────────────────────────────────────────────
    detection = combine_signals(stat_flags, ml_flags)
    print_summary(detection)

    # ── Save to Snowflake ─────────────────────────────────────────────────────
    print("Saving results to Snowflake...")
    cur.execute(CREATE_RESULT_TABLE)
    cur.execute(TRUNCATE_RESULT)
    rows = build_result_rows(df, detection)
    cur.executemany(INSERT_RESULT, rows)

    cur.close()
    conn.close()
    print(f"SUCCESS: {len(rows)} rows written to {RESULT_TABLE}.")


if __name__ == "__main__":
    main()
