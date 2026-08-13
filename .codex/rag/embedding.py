"""Lazy local E5 embedding adapter."""

import os
import warnings
from typing import Any, List, Protocol


class Embedder(Protocol):
    def embed_passages(self, texts: List[str]) -> List[List[float]]:
        ...

    def embed_query(self, text: str) -> List[float]:
        ...


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str) -> None:
        os.environ["HF_HUB_OFFLINE"] = "1"
        warnings.filterwarnings("ignore", message=r"urllib3 v2 only supports OpenSSL.*")
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as error:
            raise RuntimeError("sentence-transformers is unavailable") from error
        self._model = SentenceTransformer(model_name, device="cpu", local_files_only=True)

    @classmethod
    def from_model(cls, model: Any) -> "SentenceTransformerEmbedder":
        adapter = object.__new__(cls)
        adapter._model = model
        return adapter

    @staticmethod
    def _vectors(value: Any) -> List[List[float]]:
        rows = value.tolist() if hasattr(value, "tolist") else value
        return [[float(number) for number in row] for row in rows]

    def embed_passages(self, texts: List[str]) -> List[List[float]]:
        return self._vectors(
            self._model.encode(
                ["passage: " + text for text in texts],
                normalize_embeddings=True,
            )
        )

    def embed_query(self, text: str) -> List[float]:
        vectors = self._vectors(
            self._model.encode(["query: " + text], normalize_embeddings=True)
        )
        return vectors[0]
