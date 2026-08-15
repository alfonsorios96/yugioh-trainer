from __future__ import annotations

from pathlib import Path

from yugioh_agentic.compile_book import compile_book
from yugioh_agentic.paths import book_json_path


def test_compile_book(tmp_path: Path) -> None:
    dest = tmp_path / "book.md"
    out = compile_book(book_json_path(), dest)
    text = out.read_text(encoding="utf-8")
    assert "Funny Dark Rabbit" in text
    assert "first-going-comic-cat-no-extenders" in text
    assert "Comic Cat" in text
