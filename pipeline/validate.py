import os
import sys
from dotenv import load_dotenv
import snowflake.connector

load_dotenv()

TABLE = "DATASENSE_DB.RAW.ONLINE_RETAIL_II"

COLUMNS = [
    "InvoiceNo", "StockCode", "Description",
    "Quantity", "InvoiceDate", "UnitPrice",
    "CustomerID", "Country",
]


def get_connection():
    return snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        role=os.getenv("SNOWFLAKE_ROLE"),
    )


def run_checks(cur) -> list[dict]:
    results = []

    def check(name: str, sql: str, assertion, critical: bool = True):
        cur.execute(sql)
        value = cur.fetchone()[0]
        passed = bool(assertion(value))
        results.append({
            "name":     name,
            "value":    value,
            "passed":   passed,
            "critical": critical,
        })

    # 1 — Row count
    check(
        name="Row count > 0",
        sql=f"SELECT COUNT(*) FROM {TABLE}",
        assertion=lambda v: v > 0,
        critical=True,
    )

    # 2 — InvoiceDate range (Online Retail II spans Dec 2009 – Dec 2011)
    check(
        name="InvoiceDate min >= 2009-01-01",
        sql=f"SELECT MIN(InvoiceDate) FROM {TABLE}",
        assertion=lambda v: v is not None and v.year >= 2009,
        critical=True,
    )
    check(
        name="InvoiceDate max <= 2012-12-31",
        sql=f"SELECT MAX(InvoiceDate) FROM {TABLE}",
        assertion=lambda v: v is not None and v.year <= 2012,
        critical=True,
    )

    # 3 — No completely null columns
    for col in COLUMNS:
        cur.execute(f"SELECT COUNT(*) FROM {TABLE}")
        total = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {TABLE} WHERE {col} IS NULL")
        null_count = cur.fetchone()[0]
        all_null = (null_count == total) and (total > 0)
        results.append({
            "name":     f"Column '{col}' not completely null",
            "value":    f"{null_count:,} nulls / {total:,} rows",
            "passed":   not all_null,
            "critical": True,
        })

    # 4 — UnitPrice floor (catches major data corruption, not normal returns)
    check(
        name="UnitPrice no values below -100",
        sql=f"SELECT COUNT(*) FROM {TABLE} WHERE UnitPrice < -100",
        assertion=lambda v: v == 0,
        critical=True,
    )

    # 5 — Quantity floor
    check(
        name="Quantity no values below -10000",
        sql=f"SELECT COUNT(*) FROM {TABLE} WHERE Quantity < -10000",
        assertion=lambda v: v == 0,
        critical=True,
    )

    return results


def print_report(results: list[dict]) -> bool:
    width = 52
    print("\n" + "=" * width)
    print("  DATA QUALITY REPORT")
    print("=" * width)

    any_failure = False
    for r in results:
        status = "PASS" if r["passed"] else "FAIL"
        tag    = "[CRITICAL]" if r["critical"] and not r["passed"] else ""
        print(f"  [{status}]  {r['name']}")
        print(f"          value: {r['value']}  {tag}")
        if not r["passed"]:
            any_failure = True

    print("=" * width)
    if any_failure:
        print("  RESULT: ONE OR MORE CRITICAL CHECKS FAILED")
    else:
        print("  RESULT: ALL CHECKS PASSED")
    print("=" * width + "\n")

    return any_failure


def main():
    try:
        conn = get_connection()
        cur  = conn.cursor()
        results = run_checks(cur)
        cur.close()
        conn.close()
    except Exception as exc:
        print(f"\nFAILURE: Could not connect to Snowflake — {exc}")
        sys.exit(1)

    any_failure = print_report(results)
    if any_failure:
        sys.exit(1)


if __name__ == "__main__":
    main()
