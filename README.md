# DataSense 🔍
### Intelligent Real-Time Data Pipeline with AI-Powered Anomaly Detection

> Built with Snowflake · dbt · Python · ChromaDB · Groq AI · Tavily · FastAPI · React

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://data-sense-eight.vercel.app)
[![API Docs](https://img.shields.io/badge/API-Docs-blue)](https://datasense-api-n1s3.onrender.com/docs)

---

## 🌐 Live Demo
🔗 **App:** https://data-sense-eight.vercel.app
📡 **API:** https://datasense-api-n1s3.onrender.com/docs

> Note: Backend runs on Render free tier — first load may take 30-60 seconds to wake up.

---

## 🚨 The Problem
Every retail and e-commerce business generates millions of transactions. Hidden inside that data are anomalies — sudden revenue spikes, unexpected drops, fraud patterns, supply chain signals — that cost businesses billions annually.

By the time a human analyst notices something is wrong, it's already too late. Existing tools tell you WHAT happened, not WHY, and not in time to act.

DataSense solves this by combining a production-grade data pipeline with AI-powered investigation — automatically detecting anomalies and explaining them in plain English before anyone has to ask.

---

## ✅ What It Does
- Ingests 1,067,371 raw retail transactions through a Bronze → Silver → Gold pipeline built with dbt and Snowflake
- Cleans messy real-world data: nulls, cancellations, outliers, invalid entries — all handled and flagged with audit trail
- Detects revenue anomalies using two methods: Statistical (z-score > 2.5) and ML (IsolationForest) — confirmed when both agree
- RAG system searches a domain knowledge base using ChromaDB semantic search to provide context for every anomaly
- Tavily API pulls real-world news and events from the anomaly date for additional context
- Groq AI (Llama 3.3 70B) writes a plain-English report: root cause, severity, confidence, and recommended action — in seconds

---

## 🏗️ Architecture

```
Raw CSV (1M+ rows)
        ↓
pipeline/ingest.py → Snowflake Bronze (raw, untouched)
        ↓
dbt Silver (cleaning: nulls, cancellations, outliers, flags)
        ↓
dbt Gold (metrics: daily revenue, product velocity, customer segments)
        ↓
IsolationForest + Z-Score Anomaly Detection
        ↓
ChromaDB RAG + Tavily Web Search
        ↓
Groq AI Agent (plain-English report)
        ↓
FastAPI → React Dashboard
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Data Ingestion | Python + Pandas | Batch load 1M+ rows to Snowflake |
| Data Warehouse | Snowflake | Cloud-native columnar storage |
| Transformation | dbt | Bronze→Silver→Gold with 25 data tests |
| Anomaly Detection | XGBoost + SciPy | Statistical + ML anomaly scoring |
| Vector Database | ChromaDB | Semantic search over knowledge base |
| AI Agent | Groq (Llama 3.3 70B) | Plain-English anomaly reports |
| Web Search | Tavily API | Real-world event context |
| Backend | FastAPI | REST API with 7 endpoints |
| Frontend | React + Plotly | Live dashboard with AI side panel |
| Deployment | Render + Vercel | Free cloud hosting |

---

## 📊 Data Pipeline

### Bronze Layer
Raw data ingested exactly as-is. Zero transformations. Full audit trail.
1,067,371 rows loaded from the UCI Online Retail II dataset.

### Silver Layer — Cleaning
- CustomerID nulls → filled with 'GUEST', flagged as is_guest_purchase
- Description nulls → filled with 'UNKNOWN'
- Cancelled orders removed (InvoiceNo starting with 'C')
- Non-product stock codes filtered (POST, DOT, BANK CHARGES, etc.)
- Rows with Quantity ≤ 0 or UnitPrice ≤ 0 removed
- Outliers flagged (not dropped): price_outlier, bulk_order, high_value_transaction
- Derived columns: TotalRevenue, IsWeekend, DayOfWeek, InvoiceMonth

### Gold Layer — Business Metrics
- Daily revenue by country with 7-day rolling average
- Day-over-day revenue change % and z-score
- Product velocity rankings and fast-mover flags
- Customer segmentation: VIP (>£1000), REGULAR (£250-1000), OCCASIONAL (<£250)
- Anomaly features table combining all signals

---

## 🤖 How the AI Agent Works

**Step 1 — RAG Retrieval**
When an anomaly fires, ChromaDB searches a knowledge base of retail domain documents using semantic similarity to find the most relevant context.

**Step 2 — Real-World Context**
Tavily searches the web for news and events on the anomaly date: holidays, market events, promotions, supply chain disruptions.

**Step 3 — AI Report**
Groq's Llama 3.3 70B receives anomaly data + RAG context + Tavily results and generates a structured report with Summary, Root Cause, Severity, Recommended Action, and Confidence Level.

---

## 📈 Results
| Metric | Value |
|--------|-------|
| Raw rows processed | 1,067,371 |
| Data quality score | 97.2% |
| dbt models built | 6 |
| dbt tests passing | 25/25 |
| Confirmed anomalies | 12 |
| Possible anomalies | 24 |
| RAG knowledge chunks | 8 |
| API endpoints | 7 |

---

## 🚀 Run It Yourself

### Prerequisites
- Python 3.10+
- Node.js 18+
- Snowflake account (free trial at snowflake.com)
- Groq API key (free at console.groq.com)
- Tavily API key (free at app.tavily.com)

### Steps
```bash
# 1. Clone
git clone https://github.com/shiny-github/DataSense.git
cd DataSense

# 2. Install dependencies
pip install -r requirements.txt

# 3. Fill in .env with your credentials
cp .env .env.local

# 4. Download dataset
# Kaggle: UCI Online Retail II
# Place CSV in data/raw/

# 5. Run pipeline
python pipeline/ingest.py
python pipeline/validate.py
cd dbt_project && dbt run && dbt test && cd ..
python pipeline/detect.py
python rag/embed.py

# 6. Start backend
uvicorn api.main:app --port 8000

# 7. Start frontend
cd dashboard && npm install && npm run dev

# 8. Open http://localhost:5173
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /anomalies | List all anomalies |
| GET | /anomalies/{date} | Get anomaly by date |
| POST | /analyze/{date} | Trigger AI analysis |
| GET | /metrics/daily | Daily revenue metrics |
| GET | /products | Top 20 products |
| GET | /customers | Customer segments |
| GET | /pipeline/status | Pipeline health |

---

## 🎯 Who Is This For?
- Data engineers learning production-grade pipelines
- Analytics engineers exploring dbt + Snowflake
- Anyone building anomaly detection on real data
- Developers who want to see RAG + AI agents applied to business data

To run on your own data: replace the CSV with any transaction dataset, update the schema in sources.yml, and re-run the pipeline.

---

## 📄 License
MIT

---

## 🙋 Author
**Ananya Katram**
MS Computer Science @ UT Arlington
- LinkedIn: https://linkedin.com/in/ananya-katram
- GitHub: https://github.com/shiny-github
