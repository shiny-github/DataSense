import json
import os

from groq import Groq
from dotenv import load_dotenv
from tavily import TavilyClient

from rag.retrieve import retrieve

load_dotenv()

MODEL = "llama-3.3-70b-versatile"

_groq   = Groq(api_key=os.getenv("GROQ_API_KEY"))
_tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


def _format_features(features: dict) -> str:
    lines = []
    for k, v in features.items():
        if v is None:
            v = "N/A"
        elif isinstance(v, float):
            v = f"{v:.4f}"
        lines.append(f"  {k}: {v}")
    return "\n".join(lines)


def _format_rag_hits(hits: list[dict]) -> str:
    if not hits:
        return "  (no relevant chunks found)"
    parts = []
    for i, h in enumerate(hits, 1):
        parts.append(
            f"[KB {i}: {h['source']}, chunk {h['chunk_index']}, "
            f"similarity {h['score']}]\n{h['text']}"
        )
    return "\n\n".join(parts)


def _format_web_results(results: list[dict]) -> str:
    if not results:
        return "  (no results)"
    parts = []
    for r in results:
        parts.append(f"[{r.get('title', 'Untitled')}]\n{r.get('content', '')}")
    return "\n\n".join(parts)


_SYSTEM = (
    "You are DataSense Analyst, an expert in UK ecommerce revenue anomaly analysis. "
    "Respond ONLY with a valid JSON object — no markdown fences, no surrounding prose."
)

_USER_TEMPLATE = """\
## Anomaly Features
{features}

## Knowledge Base Context
{rag}

## Web Search Context
{web}

## Task
Analyse the revenue anomaly above. Return a JSON object with exactly these keys:
- "summary": plain-English one-sentence description of what likely happened
- "anomaly_category": one of: seasonal | promotional | b2b_bulk | viral | technical_outage | data_quality | competitor | unknown
- "confidence": one of: high | medium | low
- "probable_causes": list of objects, each with "cause" (str), "reasoning" (str), "likelihood" ("high"|"medium"|"low")
- "recommended_actions": list of strings (actionable next steps for the analyst)
- "data_quality_flags": list of strings (empty list if none)
- "calendar_context": string describing relevant UK retail calendar events for this date

Return only the JSON.\
"""


def analyze(features: dict) -> dict:
    """
    Full analysis pipeline: RAG + Tavily web search + Groq/Llama.

    Parameters
    ----------
    features:
        Dict of anomaly feature fields for one sale date, typically from
        GOLD_ANOMALY_FEATURES joined with ANOMALY_RESULTS.

    Returns
    -------
    Structured analysis dict with provenance metadata attached under
    ``_rag_sources``, ``_web_sources``, and ``_model`` keys.
    """
    z         = float(features.get("revenue_zscore") or 0)
    direction = "spike" if z > 0 else "drop"
    product   = features.get("top_product_that_day") or ""
    sale_date = str(features.get("sale_date", ""))

    # ── RAG retrieval ──────────────────────────────────────────────────────────
    rag_query = f"retail revenue {direction} anomaly {product}".strip()
    rag_hits  = retrieve(rag_query, n_results=3)

    # ── Tavily web search ──────────────────────────────────────────────────────
    web_query = (
        f"UK retail ecommerce revenue {direction} {sale_date} "
        f"{'cause ' + product if product else 'causes'}"
    ).strip()
    try:
        tavily_resp = _tavily.search(web_query, max_results=3, search_depth="basic")
        web_results = tavily_resp.get("results", [])
    except Exception:
        web_results = []

    # ── Groq ───────────────────────────────────────────────────────────────────
    user_msg = _USER_TEMPLATE.format(
        features=_format_features(features),
        rag=_format_rag_hits(rag_hits),
        web=_format_web_results(web_results),
    )

    response = _groq.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=1000,
    )

    text = response.choices[0].message.content

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        result = {
            "summary": text,
            "anomaly_category": "unknown",
            "confidence": "low",
            "probable_causes": [],
            "recommended_actions": [],
            "data_quality_flags": [],
            "calendar_context": "",
        }

    result["_rag_sources"] = [
        {"source": h["source"], "chunk": h["chunk_index"], "score": h["score"]}
        for h in rag_hits
    ]
    result["_web_sources"] = [
        {"title": r.get("title", ""), "url": r.get("url", "")}
        for r in web_results
    ]
    result["_model"] = MODEL

    return result
