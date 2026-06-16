import rag.embed as _embed

TOP_K = 3


def retrieve(query: str, n_results: int = TOP_K) -> list[dict]:
    col = _embed.collection
    if col is None:
        raise RuntimeError("Knowledge base not embedded — call embed.main() first")
    results = col.query(
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
            "text":        text,
            "source":      meta["source"],
            "chunk_index": meta["chunk_index"],
            "score":       round(1 - dist, 4),
        })
    return hits


def print_results(query: str, hits: list[dict]) -> None:
    print(f'\nQuery: "{query}"')
    print("=" * 60)
    for i, hit in enumerate(hits, 1):
        print(f"\n[Result {i}]  source={hit['source']}  "
              f"chunk={hit['chunk_index']}  score={hit['score']}")
        print("-" * 60)
        preview = hit["text"][:300]
        if len(hit["text"]) > 300:
            preview += " ..."
        print(preview)
    print("\n" + "=" * 60)


if __name__ == "__main__":
    from rag.embed import main as _embed_main
    _embed_main()
    hits = retrieve("sudden revenue spike on a weekday")
    print_results("sudden revenue spike on a weekday", hits)
