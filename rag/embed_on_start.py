"""Auto-embed the knowledge base on startup if ChromaDB is absent or empty."""
import logging

import chromadb
from chromadb.utils import embedding_functions

log = logging.getLogger("datasense.rag")

CHROMA_PATH = "./chroma_db"
COLLECTION  = "datasense_knowledge"


def ensure_embedded() -> None:
    """
    Check whether the ChromaDB collection already has documents.
    If the collection is missing or empty, run the full embedding pipeline.
    Called from the FastAPI lifespan so Render cold starts work without
    a manual pre-build step.
    """
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef     = embedding_functions.DefaultEmbeddingFunction()

    try:
        col   = client.get_collection(COLLECTION, embedding_function=ef)
        count = col.count()
        if count > 0:
            log.info("ChromaDB '%s' ready — %d chunks already embedded.", COLLECTION, count)
            return
    except Exception:
        pass

    log.info("ChromaDB collection missing or empty — running embedding pipeline…")
    from rag.embed import main as _embed
    _embed()
    log.info("Knowledge base embedding complete.")
