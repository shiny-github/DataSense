"""Embed the knowledge base into in-memory ChromaDB on every server start."""
import logging

log = logging.getLogger("datasense.rag")


def ensure_embedded() -> None:
    """
    Build the in-memory ChromaDB collection from the knowledge base txt files.
    EphemeralClient data is lost on process exit, so this runs on every cold
    start before the app accepts requests.  Skips if already populated (i.e.,
    called a second time within the same process).
    """
    from rag import embed

    if embed.collection is not None:
        count = embed.collection.count()
        if count > 0:
            log.info("Knowledge base already in memory — %d chunks ready.", count)
            return

    log.info("Embedding knowledge base into memory…")
    embed.main()

    count = embed.collection.count() if embed.collection is not None else 0
    log.info("Knowledge base embedded: %d chunks ready", count)
