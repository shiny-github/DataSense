# DataSense — Intelligent Data Pipeline with AI-Powered Anomaly Detection

## What It Does

DataSense ingests two years of UK retail transaction data, transforms it through a Bronze → Silver → Gold dbt pipeline into Snowflake, and then applies dual-method anomaly detection (statistical z-scoring + IsolationForest) to flag unusual revenue days. When an anomaly is detected, an AI agent retrieves relevant context from a curated knowledge base and the open web, then asks Claude to produce a plain-English root-cause report — all surfaced in a React dashboard.

## Architecture

```
Raw CSV (Kaggle)
      │
      ▼
┌─────────────┐     ┌─────────────────────┐
│  Bronze     │────▶│  Silver             │
│  raw copy   │     │  cleaned + flagged  │
└─────────────┘     └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Gold models        │
                    │  daily_revenue      │
                    │  product_velocity   │
                    │  customer_metrics   │
                    │  anomaly_features   │
                    └──────────┬──────────┘
                               │
              ┌────────────────▼────────────────────┐
              │  Anomaly Detection (Python)          │
              │  Statistical z-score > 2.5           │
              │  + IsolationForest (ML)              │
              │  → confirmed / possible / normal     │
              └────────────┬────────────────────────┘
                           │
              ┌────────────▼────────────────────────┐
              │  AI Agent                           │
              │  ChromaDB RAG retrieval             │
              │  + Tavily web search                │
              │  + Claude (claude-opus-4-8)         │
              └────────────┬────────────────────────┘
                           │
              ┌────────────▼────────────────────────┐
              │  FastAPI backend                    │
              └────────────┬────────────────────────┘
                           │
              ┌────────────▼────────────────────────┐
              │  React + Plotly dashboard           │
              └─────────────────────────────────────┘
```

## Tech Stack

| Layer              | Technology                  | Purpose                                              |
| ------------------ | --------------------------- | ---------------------------------------------------- |
| Ingestion          | Python + pandas             | Load CSV into Snowflake in batches                   |
| Transformation     | dbt                         | Bronze → Silver → Gold SQL models                    |
| Warehouse          | Snowflake                   | Scalable storage and compute for all pipeline data   |
| Anomaly Detection  | scikit-learn (IsolationForest) + z-score | Dual-method statistical + ML flagging |
| Vector DB          | ChromaDB                    | Embed and retrieve knowledge-base chunks at query time |
| AI Agent           | Anthropic (claude-opus-4-8) | Root-cause analysis from features + RAG + web context |
| Web Search         | Tavily                      | Real-time web context for anomaly investigation      |
| Backend            | FastAPI + uvicorn           | REST API serving anomaly data and AI analysis        |
| Frontend           | React + Vite + Plotly.js    | Interactive dark-theme dashboard                     |

## The Data Pipeline

**Bronze** is a verbatim copy of the source CSV loaded into `DATASENSE_DB.RAW.ONLINE_RETAIL_II` with no transformations. It preserves all rows including cancellations (InvoiceNo starting with C), negative quantities, and null values. The bronze layer is the audit record.

**Silver** (`silver_retail_cleaned`) applies a sequence of cleaning steps: null critical fields are dropped, UnitPrice nulls are imputed using per-product median via a window function, cancelled orders and negative quantities are removed, known non-product stock codes (POST, DOT, BANK CHARGES, etc.) are filtered out, and CustomerID nulls are filled with the string `GUEST`. Outlier rows are flagged with a `data_quality_flag` column (`price_outlier`, `bulk_order`, `high_value_transaction`) but retained in the dataset for analyst review.

**Gold** contains four models built on top of Silver:
- `gold_daily_revenue` — daily revenue and order counts by country
- `gold_product_velocity` — per-product daily units sold, 7-day rolling average, and lifetime revenue rank
- `gold_customer_metrics` — per-customer total spend, order frequency, and RFM-based segment (VIP / REGULAR / OCCASIONAL)
- `gold_anomaly_features` — one row per calendar day with revenue z-score, day-over-day change, 7-day rolling average, and the top-selling product for that day

## Anomaly Detection

`pipeline/detect.py` reads `gold_anomaly_features` and applies two independent methods:

1. **Statistical z-score** — flags any day where `|revenue_zscore| > 2.5`. This identifies days that are unusually far from the dataset mean.

2. **IsolationForest** — trains on four features (`revenue_zscore`, `revenue_dod_change_pct`, `total_orders`, `unique_customers`) with `contamination=0.05` and flags multivariate outliers that the univariate z-score might miss.

The two signals are combined:
- **confirmed_anomaly** — both methods agree the day is anomalous
- **possible_anomaly** — exactly one method flags the day
- **normal** — neither method flags the day

Results are written to `DATASENSE_DB.PUBLIC.ANOMALY_RESULTS`.

## RAG System

Three knowledge-base documents live in `rag/knowledge_base/`:

- `data_quality_issues.txt` — explains why cancelled orders, guest purchases, price outliers, and bulk orders appear in the data
- `ecommerce_metrics_guide.txt` — defines AOV, CLV, product velocity, z-score interpretation, and UK day-of-week patterns
- `retail_anomaly_patterns.txt` — catalogues common causes of revenue spikes and drops: seasonal events, flash sales, viral demand, B2B orders, outages, and fraud

`rag/embed.py` chunks each document into 500-word overlapping windows and stores them in a ChromaDB collection (`datasense_knowledge`) using the default sentence-transformer embedding function.

At query time, `rag/retrieve.py` embeds the query and returns the top-3 most similar chunks by cosine similarity, along with source file, chunk index, and similarity score.

## AI Agent

`agent/analyst.py` implements a three-step analysis pipeline called for each anomalous date:

1. **RAG retrieval** — builds a query like `"retail revenue spike anomaly 85123A"` and retrieves the 3 most relevant knowledge-base chunks
2. **Tavily web search** — searches for current context: `"UK retail ecommerce revenue spike 2010-12-01 causes"` to surface any external events that might explain the anomaly
3. **Claude report** — sends all context (features, RAG chunks, web results) to `claude-opus-4-8` with adaptive thinking enabled and a structured JSON output format. The response includes: summary, anomaly category, confidence level, probable causes with likelihoods, recommended actions, data quality flags, and UK calendar context.

Results are cached in memory so repeated requests for the same date are instant.

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repo-url>
cd DataSense
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Fill in environment variables

Copy `.env` and fill in your credentials:

```
SNOWFLAKE_ACCOUNT=your-account-identifier
SNOWFLAKE_USER=your-username
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_DATABASE=DATASENSE_DB
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=ACCOUNTADMIN
CLAUDE_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
```

### 4. Download the dataset

Download the **Online Retail II** dataset from [UCI ML Repository / Kaggle](https://www.kaggle.com/datasets/mashlyn/online-retail-ii-uci) and place it at:

```
data/raw/online_retail_II.csv
```

### 5. Ingest raw data into Snowflake

```bash
python pipeline/ingest.py
```

### 6. Validate the ingestion

```bash
python pipeline/validate.py
```

### 7. Run dbt transformations

```bash
cd dbt_project
dbt run
```

### 8. Run dbt tests

```bash
dbt test
cd ..
```

### 9. Detect anomalies

```bash
python pipeline/detect.py
```

### 10. Embed the knowledge base

```bash
python rag/embed.py
```

### 11. Start the API

```bash
uvicorn api.main:app --reload
```

The API will be available at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the interactive API explorer.

### 12. Start the dashboard

```bash
cd dashboard
npm install
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

## Project Structure

```
DataSense/
├── .env                        # Environment variables (fill before running)
├── requirements.txt            # Python dependencies
├── README.md                   # This file
│
├── data/
│   └── raw/
│       └── online_retail_II.csv   # Source dataset (download from Kaggle)
│
├── pipeline/
│   ├── ingest.py               # Loads CSV into Snowflake RAW layer in batches
│   ├── validate.py             # Runs data quality checks on the RAW table
│   └── detect.py               # Applies z-score + IsolationForest; writes ANOMALY_RESULTS
│
├── dbt_project/
│   └── models/
│       ├── bronze/
│       │   └── bronze_retail_raw.sql       # Verbatim view of the RAW source
│       ├── silver/
│       │   └── silver_retail_cleaned.sql   # Cleaned, flagged, enriched transactions
│       └── gold/
│           ├── gold_daily_revenue.sql       # Daily revenue by country
│           ├── gold_product_velocity.sql    # Per-product daily sales + rolling avg
│           ├── gold_customer_metrics.sql    # Customer RFM metrics and segments
│           └── gold_anomaly_features.sql    # Per-day stats for anomaly detection
│
├── rag/
│   ├── embed.py                # Chunks knowledge-base docs; writes to ChromaDB
│   ├── retrieve.py             # Semantic search against ChromaDB collection
│   └── knowledge_base/
│       ├── data_quality_issues.txt         # Data quality patterns and explanations
│       ├── ecommerce_metrics_guide.txt     # Metric definitions and benchmarks
│       └── retail_anomaly_patterns.txt     # Spike/drop cause taxonomy
│
├── agent/
│   └── analyst.py              # RAG + Tavily + Claude analysis pipeline
│
├── api/
│   └── main.py                 # FastAPI app: health, anomalies, metrics, AI analysis
│
└── dashboard/
    ├── package.json            # npm dependencies
    ├── vite.config.js          # Vite build config
    ├── index.html              # HTML entry point
    ├── .env                    # VITE_API_URL
    └── src/
        ├── main.jsx            # React entry point
        ├── App.jsx             # Router + Navbar + tab layout
        ├── api.js              # Axios API client with all endpoint helpers
        ├── components/
        │   ├── Navbar.jsx      # Top bar: logo, pipeline status dot, timestamp
        │   ├── KpiCard.jsx     # Reusable KPI metric card
        │   └── SidePanel.jsx   # Sliding AI analysis panel (triggered per anomaly row)
        └── pages/
            ├── HomePage.jsx    # KPI cards + revenue chart + anomaly table
            ├── ProductsPage.jsx   # Top-20 products horizontal bar chart
            └── CustomersPage.jsx  # Customer segment pie chart + stats table
```

## License

MIT
