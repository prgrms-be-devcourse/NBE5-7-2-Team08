import sys
import tempfile
import types
import unittest
import os
from pathlib import Path
from unittest.mock import patch


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from chunk_markdown import Chunk
from embedding import SentenceTransformerEmbedder
from index import load_dense_chunks, open_index, pack_embedding, sync_chunks, unpack_embedding


class FakeSentenceTransformer:
    def __init__(self) -> None:
        self.calls = []
        self.responses = [[[0.6, 0.8]], [[1.0, 0.0]]]

    def encode(self, texts, normalize_embeddings):
        self.calls.append((texts, {"normalize_embeddings": normalize_embeddings}))
        return self.responses.pop(0)


class EmbeddingTest(unittest.TestCase):
    def test_index_build_model_load_allows_initial_download(self) -> None:
        calls = []

        class FakeConstructor:
            def __init__(self, *args, **kwargs) -> None:
                calls.append((args, kwargs))

        with patch.dict(os.environ, {}, clear=True), patch.dict(
            sys.modules, {"sentence_transformers": types.SimpleNamespace(SentenceTransformer=FakeConstructor)}
        ):
            SentenceTransformerEmbedder("intfloat/multilingual-e5-small", allow_download=True)

        self.assertNotIn("HF_HUB_OFFLINE", os.environ)
        self.assertEqual(
            calls,
            [(("intfloat/multilingual-e5-small",), {"device": "cpu", "local_files_only": False})],
        )

    def test_runtime_model_loads_from_the_local_cache_only(self) -> None:
        calls = []

        class FakeConstructor:
            def __init__(self, *args, **kwargs) -> None:
                calls.append((args, kwargs))

        with patch.dict(os.environ, {}, clear=True), patch.dict(
            sys.modules, {"sentence_transformers": types.SimpleNamespace(SentenceTransformer=FakeConstructor)}
        ), patch("embedding.warnings.filterwarnings") as filter_warnings:
            SentenceTransformerEmbedder("intfloat/multilingual-e5-small")
            self.assertEqual(os.environ["HF_HUB_OFFLINE"], "1")

        filter_warnings.assert_called_once_with(
            "ignore", message=r"urllib3 v2 only supports OpenSSL.*"
        )
        self.assertEqual(
            calls,
            [(("intfloat/multilingual-e5-small",), {"device": "cpu", "local_files_only": True})],
        )

    def test_e5_adapter_uses_prefixes_and_normalized_embeddings(self) -> None:
        model = FakeSentenceTransformer()
        adapter = SentenceTransformerEmbedder.from_model(model)

        self.assertEqual(adapter.embed_passages(["문서"]), [[0.6, 0.8]])
        self.assertEqual(adapter.embed_query("질문"), [1.0, 0.0])
        self.assertEqual(
            model.calls,
            [
                (["passage: 문서"], {"normalize_embeddings": True}),
                (["query: 질문"], {"normalize_embeddings": True}),
            ],
        )

    def test_float32_round_trip_and_model_mismatch(self) -> None:
        self.assertEqual(unpack_embedding(pack_embedding([0.25, -0.5])), [0.25, -0.5])

        with tempfile.TemporaryDirectory() as temporary_directory:
            connection = open_index(Path(temporary_directory) / "context.sqlite3")
            try:
                chunk = Chunk("docs/a.md", "A", 1, 1, "content", "hash")
                sync_chunks(connection, [chunk], "selected-model")
                connection.execute(
                    "UPDATE chunks SET embedding = ?, embedding_model = ?",
                    (pack_embedding([1.0, 0.0]), "selected-model"),
                )
                connection.commit()

                self.assertEqual(load_dense_chunks(connection, "other-model"), [])
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
