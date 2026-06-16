# DataSense full pipeline runner
# Usage: .\run_pipeline.ps1
# Runs: dbt deps/run/test → detect.py → embed.py → uvicorn

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== DataSense Pipeline ===" -ForegroundColor Cyan
Write-Host ""

# ── Credentials ───────────────────────────────────────────────────────────────

$password = Read-Host "Enter Snowflake password"

# Read API keys from .env (parse KEY=VALUE lines, ignore blanks and comments)
$envLines  = Get-Content (Join-Path $PSScriptRoot ".env") | Where-Object { $_ -match "^[^#].+=.+" }
$groqKey   = ($envLines | Where-Object { $_ -match "^GROQ_API_KEY=" })   -replace "^GROQ_API_KEY=",   ""
$tavilyKey = ($envLines | Where-Object { $_ -match "^TAVILY_API_KEY=" }) -replace "^TAVILY_API_KEY=", ""

if (-not $groqKey)   { Write-Warning "GROQ_API_KEY not found in .env — AI analysis will fail" }
if (-not $tavilyKey) { Write-Warning "TAVILY_API_KEY not found in .env — web search will be skipped" }

# ── Set environment variables ─────────────────────────────────────────────────

$env:SNOWFLAKE_ACCOUNT   = "hhenggv-du79528"
$env:SNOWFLAKE_USER      = "AnSnowflake"
$env:SNOWFLAKE_PASSWORD  = $password
$env:SNOWFLAKE_DATABASE  = "DATASENSE_DB"
$env:SNOWFLAKE_SCHEMA    = "PUBLIC"
$env:SNOWFLAKE_WAREHOUSE = "COMPUTE_WH"
$env:SNOWFLAKE_ROLE      = "ACCOUNTADMIN"
$env:GROQ_API_KEY        = $groqKey
$env:TAVILY_API_KEY      = $tavilyKey

Write-Host "Environment variables set." -ForegroundColor Green
Write-Host ""

# ── Step 1: dbt ───────────────────────────────────────────────────────────────

Write-Host "[1/4] Running dbt deps + run + test..." -ForegroundColor Yellow

Push-Location (Join-Path $PSScriptRoot "dbt_project")

Write-Host "  → dbt deps"
dbt deps
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "dbt deps failed"; exit 1 }

Write-Host "  → dbt run"
dbt run
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "dbt run failed"; exit 1 }

Write-Host "  → dbt test"
dbt test
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "dbt test failed"; exit 1 }

Pop-Location
Write-Host ""

# ── Step 2: Anomaly detection ─────────────────────────────────────────────────

Write-Host "[2/4] Running anomaly detection..." -ForegroundColor Yellow
python pipeline\detect.py
if ($LASTEXITCODE -ne 0) { Write-Error "detect.py failed"; exit 1 }
Write-Host ""

# ── Step 3: Knowledge base embedding ─────────────────────────────────────────

Write-Host "[3/4] Embedding knowledge base..." -ForegroundColor Yellow
python rag\embed.py
if ($LASTEXITCODE -ne 0) { Write-Error "embed.py failed"; exit 1 }
Write-Host ""

# ── Step 4: API server ────────────────────────────────────────────────────────

Write-Host "[4/4] Starting API server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  API:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

uvicorn api.main:app --port 8000
