import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

import snowflake.connector
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from agent.analyst import analyze
from rag.embed_on_start import ensure_embedded

load_dotenv()

log = logging.getLogger("datasense.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

RESULT_TABLE   = "DATASENSE_DB.PUBLIC.ANOMALY_RESULTS"
FEATURE_TABLE  = "DATASENSE_DB.PUBLIC.GOLD_ANOMALY_FEATURES"
SILVER_TABLE   = "DATASENSE_DB.PUBLIC.SILVER_RETAIL_CLEANED"
RAW_TABLE      = "DATASENSE_DB.RAW.ONLINE_RETAIL_II"
PRODUCT_TABLE  = "DATASENSE_DB.PUBLIC.GOLD_PRODUCT_VELOCITY"
CUSTOMER_TABLE = "DATASENSE_DB.PUBLIC.GOLD_CUSTOMER_METRICS"

_analysis_cache: dict[str, dict] = {}


# ── Snowflake helpers ─────────────────────────────────────────────────────────

def _get_conn():
    return snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        role=os.getenv("SNOWFLAKE_ROLE"),
        database=os.getenv("SNOWFLAKE_DATABASE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA"),
    )


def _rows_as_dicts(cur) -> list[dict]:
    cols = [d[0].lower() for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure ChromaDB knowledge base is populated (auto-embeds on first run / cold start)
    await asyncio.to_thread(ensure_embedded)

    # Verify Snowflake reachability (non-fatal)
    try:
        conn = _get_conn()
        conn.cursor().execute("SELECT CURRENT_VERSION()")
        conn.close()
        log.info("Snowflake connection verified on startup")
    except Exception as exc:
        log.warning("Snowflake connection failed on startup: %s", exc)
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="DataSense API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        t0       = time.perf_counter()
        response = await call_next(request)
        ms       = (time.perf_counter() - t0) * 1000
        log.info(
            "%s %s → %d  (%.0f ms)",
            request.method, request.url.path, response.status_code, ms,
        )
        return response


app.add_middleware(RequestLogMiddleware)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/anomalies")
def list_anomalies():
    """Return all rows from ANOMALY_RESULTS ordered by date descending."""
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(f"SELECT * FROM {RESULT_TABLE} ORDER BY sale_date DESC")
        rows = _rows_as_dicts(cur)
        cur.close()
        conn.close()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"anomalies": rows, "count": len(rows)}


@app.get("/anomalies/{sale_date}")
def get_anomaly(sale_date: str):
    """Return full feature set for one date, with detection_method appended."""
    try:
        conn = _get_conn()
        cur  = conn.cursor()

        cur.execute(
            f"SELECT * FROM {FEATURE_TABLE} WHERE sale_date = %s",
            (sale_date,),
        )
        rows = _rows_as_dicts(cur)
        if not rows:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail=f"No feature data for {sale_date}")
        row = rows[0]

        cur.execute(
            f"SELECT detection_method FROM {RESULT_TABLE} WHERE sale_date = %s",
            (sale_date,),
        )
        result = cur.fetchone()
        if result:
            row["detection_method"] = result[0]

        cur.close()
        conn.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return row


@app.get("/metrics/daily")
def metrics_daily():
    """Full daily feature set with detection_method, ordered by date."""
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(f"""
            SELECT
                f.sale_date, f.total_revenue, f.total_orders, f.unique_customers,
                f.revenue_zscore, f.revenue_dod_change_pct, f.revenue_7day_rolling_avg,
                f.anomaly_type, f.top_product_that_day, f.is_weekend,
                r.detection_method
            FROM {FEATURE_TABLE} f
            LEFT JOIN {RESULT_TABLE} r ON f.sale_date = r.sale_date
            ORDER BY f.sale_date
        """)
        rows = _rows_as_dicts(cur)
        cur.close()
        conn.close()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"daily": rows, "count": len(rows)}


@app.get("/pipeline/status")
def pipeline_status():
    """Bronze vs silver row counts and derived data quality score."""
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {RAW_TABLE}")
        bronze_rows = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SILVER_TABLE}")
        silver_rows = cur.fetchone()[0]
        cur.close()
        conn.close()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    dq_score = round(silver_rows / bronze_rows * 100, 1) if bronze_rows else 0.0
    return {"bronze_rows": bronze_rows, "silver_rows": silver_rows, "data_quality_score": dq_score}


@app.get("/products")
def get_products():
    """Top 20 products by lifetime revenue from the gold product velocity model."""
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(f"""
            SELECT stockcode AS stock_code, description, SUM(daily_revenue) AS total_revenue
            FROM {PRODUCT_TABLE}
            GROUP BY 1, 2
            ORDER BY total_revenue DESC
            LIMIT 20
        """)
        rows = _rows_as_dicts(cur)
        cur.close()
        conn.close()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"products": rows}


@app.get("/customers")
def get_customers():
    """Customer count and total spend aggregated by segment."""
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(f"""
            SELECT customer_segment AS segment,
                   COUNT(*)         AS count,
                   SUM(total_spend) AS total_revenue
            FROM {CUSTOMER_TABLE}
            GROUP BY customer_segment
            ORDER BY total_revenue DESC
        """)
        rows = _rows_as_dicts(cur)
        cur.close()
        conn.close()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"segments": rows}


@app.post("/analyze/{sale_date}")
async def analyze_anomaly(sale_date: str):
    """
    Run AI analysis on one date's anomaly features.
    Results are cached in memory; subsequent calls return the cached copy.
    """
    if sale_date in _analysis_cache:
        return {**_analysis_cache[sale_date], "_cached": True}

    # Fetch features from Snowflake
    try:
        conn = _get_conn()
        cur  = conn.cursor()

        cur.execute(
            f"SELECT * FROM {FEATURE_TABLE} WHERE sale_date = %s",
            (sale_date,),
        )
        rows = _rows_as_dicts(cur)
        if not rows:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail=f"No feature data for {sale_date}")
        features = rows[0]

        cur.execute(
            f"SELECT detection_method FROM {RESULT_TABLE} WHERE sale_date = %s",
            (sale_date,),
        )
        result = cur.fetchone()
        if result:
            features["detection_method"] = result[0]

        cur.close()
        conn.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    # Run analyst in a thread (blocks on Anthropic + Tavily + ChromaDB I/O)
    try:
        analysis = await asyncio.to_thread(analyze, features)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}")

    _analysis_cache[sale_date] = analysis
    return {**analysis, "_cached": False}
