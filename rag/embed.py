from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

KNOWLEDGE_DIR = Path("rag/knowledge_base")
COLLECTION    = "datasense_knowledge"
CHUNK_WORDS   = 500
OVERLAP_WORDS = 50

# Module-level singletons populated by main(); retrieve.py reads these directly.
client     = None
collection = None


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    words  = text.split()
    step   = chunk_size - overlap
    chunks = []
    for start in range(0, len(words), step):
        chunk = words[start : start + chunk_size]
        if chunk:
            chunks.append(" ".join(chunk))
        if start + chunk_size >= len(words):
            break
    return chunks


def main():
    global client, collection

    txt_files = sorted(KNOWLEDGE_DIR.glob("*.txt"))
    if not txt_files:
        print(f"No .txt files found in {KNOWLEDGE_DIR}")
        return

    client = chromadb.EphemeralClient()
    ef     = embedding_functions.DefaultEmbeddingFunction()

    try:
        client.delete_collection(COLLECTION)
    except Exception:
        pass
    collection = client.create_collection(COLLECTION, embedding_function=ef)

    total_chunks = 0
    for txt_path in txt_files:
        text   = txt_path.read_text(encoding="utf-8")
        chunks = chunk_text(text, CHUNK_WORDS, OVERLAP_WORDS)

        ids       = [f"{txt_path.stem}__chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {"source": txt_path.name, "chunk_index": i, "word_count": len(c.split())}
            for i, c in enumerate(chunks)
        ]

        collection.add(documents=chunks, ids=ids, metadatas=metadatas)
        print(f"  {txt_path.name}: {len(chunks)} chunks embedded")
        total_chunks += len(chunks)

    print(f"\n{total_chunks} chunks embedded from {len(txt_files)} files.")


if __name__ == "__main__":
    main()
