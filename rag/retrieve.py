from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

CHROMA_PATH = "./chroma_db"
COLLECTION  = "datasense_knowledge"
TOP_K       = 3


def get_collection():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef     = embedding_functions.DefaultEmbeddingFunction()
    return client.get_collection(COLLECTION, embedding_function=ef)


def retrieve(query: str, n_results: int = TOP_K) -> list[dict]:
    collection = get_collection()
    results    = collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )
    hits = []
    for text, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        hits.append({
            "text":       text,
            "source":     meta["source"],
            "chunk_index": meta["chunk_index"],
            "score":      round(1 - dist, 4),   # cosine similarity ≈ 1 - distance
        })
    return hits


def print_results(query: str, hits: list[dict]) -> None:
    print(f'\nQuery: "{query}"')
    print("=" * 60)
    for i, hit in enumerate(hits, 1):
        print(f"\n[Result {i}]  source={hit['source']}  "
              f"chunk={hit['chunk_index']}  score={hit['score']}")
        print("-" * 60)
        # Print first 300 characters of the chunk for readability
        preview = hit["text"][:300]
        if len(hit["text"]) > 300:
            preview += " ..."
        print(preview)
    print("\n" + "=" * 60)


# ── Inline test ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    query = "sudden revenue spike on a weekday"
    hits  = retrieve(query)
    print_results(query, hits)
