import os
import sys
import logging
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
import snowflake.connector

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

RAW_CSV   = Path("data/raw/online_retail_II.csv")
BATCH_SIZE = 10_000

# UCI Online Retail II ships with these column names — normalise to our schema
COLUMN_MAP = {
    "Invoice":     "InvoiceNo",
    "Price":       "UnitPrice",
    "Customer ID": "CustomerID",
}

CREATE_DB     = "CREATE DATABASE IF NOT EXISTS DATASENSE_DB"
CREATE_SCHEMA = "CREATE SCHEMA IF NOT EXISTS DATASENSE_DB.RAW"
CREATE_TABLE  = """
CREATE TABLE IF NOT EXISTS DATASENSE_DB.RAW.ONLINE_RETAIL_II (
    InvoiceNo    VARCHAR,
    StockCode    VARCHAR,
    Description  VARCHAR,
    Quantity     INTEGER,
    InvoiceDate  TIMESTAMP,
    UnitPrice    FLOAT,
    CustomerID   VARCHAR,
    Country      VARCHAR,
    _loaded_at   TIMESTAMP DEFAULT current_timestamp()
)
"""
TRUNCATE_TABLE = "TRUNCATE TABLE DATASENSE_DB.RAW.ONLINE_RETAIL_II"
INSERT_SQL = """
INSERT INTO DATASENSE_DB.RAW.ONLINE_RETAIL_II
    (InvoiceNo, StockCode, Description, Quantity,
     InvoiceDate, UnitPrice, CustomerID, Country)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""


def get_connection():
    return snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        role=os.getenv("SNOWFLAKE_ROLE"),
    )


def load_csv(path: Path) -> pd.DataFrame:
    for enc in ("utf-8", "latin-1"):
        try:
            df = pd.read_csv(path, encoding=enc, low_memory=False)
            log.info("Read %s with encoding=%s", path, enc)
            return df
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"Could not decode {path} with utf-8 or latin-1")


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns=COLUMN_MAP)
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"], errors="coerce")
    # CustomerID is numeric in the source — store as string or None
    if "CustomerID" in df.columns:
        df["CustomerID"] = (
            df["CustomerID"]
            .apply(lambda x: str(int(x)) if pd.notna(x) else None)
        )
    return df


def df_to_rows(chunk: pd.DataFrame) -> list:
    cols = ["InvoiceNo", "StockCode", "Description",
            "Quantity", "InvoiceDate", "UnitPrice", "CustomerID", "Country"]
    sub = chunk[cols].copy()
    # Convert NaN → None so Snowflake stores NULL
    sub = sub.where(sub.notna(), other=None)
    # Snowflake connector needs native Python types
    sub["Quantity"]    = sub["Quantity"].apply(lambda x: int(x) if x is not None else None)
    sub["UnitPrice"]   = sub["UnitPrice"].apply(lambda x: float(x) if x is not None else None)
    sub["InvoiceDate"] = sub["InvoiceDate"].apply(
        lambda x: x.isoformat() if x is not None else None
    )
    return [tuple(r) for r in sub.itertuples(index=False, name=None)]


def main():
    if not RAW_CSV.exists():
        print(f"FAILURE: CSV not found at {RAW_CSV}")
        sys.exit(1)

    # ── Load CSV ──────────────────────────────────────────────────────────────
    df = load_csv(RAW_CSV)
    df = prepare_dataframe(df)
    total_rows = len(df)
    print(f"\nTotal rows in CSV : {total_rows:,}")

    # ── Snowflake setup ───────────────────────────────────────────────────────
    try:
        conn = get_connection()
        cur  = conn.cursor()

        cur.execute(CREATE_DB)
        cur.execute(CREATE_SCHEMA)
        cur.execute(CREATE_TABLE)
        cur.execute(TRUNCATE_TABLE)
        log.info("Table ready — starting batch load")

        # ── Batch load ────────────────────────────────────────────────────────
        batches_loaded = 0
        for start in range(0, total_rows, BATCH_SIZE):
            chunk = df.iloc[start : start + BATCH_SIZE]
            rows  = df_to_rows(chunk)
            cur.executemany(INSERT_SQL, rows)
            batches_loaded += 1
            end = min(start + BATCH_SIZE, total_rows)
            print(f"  Batch {batches_loaded:>3} loaded  ({end:>7,} / {total_rows:,} rows)")

        # ── Verify ────────────────────────────────────────────────────────────
        cur.execute("SELECT COUNT(*) FROM DATASENSE_DB.RAW.ONLINE_RETAIL_II")
        snowflake_count = cur.fetchone()[0]

        cur.close()
        conn.close()

    except Exception as exc:
        print(f"\nFAILURE: {exc}")
        sys.exit(1)

    print(f"\nBatches loaded    : {batches_loaded}")
    print(f"Rows in Snowflake : {snowflake_count:,}")
    print("\nSUCCESS: Ingestion complete.")


if __name__ == "__main__":
    main()
