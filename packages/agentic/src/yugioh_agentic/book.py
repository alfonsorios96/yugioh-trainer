from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .paths import book_json_path


@dataclass(frozen=True)
class BookStep:
    kind: str
    cardId: int
    place: str | None = None
    stance: str | None = None
    effectIndex: int | None = None


@dataclass(frozen=True)
class BookWhen:
    going: str | None = None
    handContains: tuple[int, ...] = ()
    handExcludes: tuple[int, ...] = ()
    worldOnField: bool | None = None
    threats: tuple[str, ...] = ()


@dataclass
class BookSituation:
    situationId: str
    title: str
    priority: int
    when: BookWhen
    steps: list[BookStep] = field(default_factory=list)
    notes: str = ""


@dataclass
class ComboBook:
    deckId: str
    situations: list[BookSituation]


_cache: tuple[float, ComboBook] | None = None


def _ints(values: Any) -> tuple[int, ...]:
    if not values:
        return ()
    return tuple(int(x) for x in values)


def _step(raw: dict[str, Any]) -> BookStep:
    effect = raw.get("effectIndex")
    return BookStep(
        kind=str(raw.get("kind") or ""),
        cardId=int(raw.get("cardId") or 0),
        place=raw.get("place"),
        stance=raw.get("stance"),
        effectIndex=int(effect) if effect is not None else None,
    )


def _when(raw: dict[str, Any] | None) -> BookWhen:
    data = raw or {}
    return BookWhen(
        going=data.get("going"),
        handContains=_ints(data.get("handContains")),
        handExcludes=_ints(data.get("handExcludes")),
        worldOnField=data.get("worldOnField"),
        threats=tuple(str(t) for t in data.get("threats") or ()),
    )


def _situation(raw: dict[str, Any]) -> BookSituation:
    return BookSituation(
        situationId=str(raw["situationId"]),
        title=str(raw.get("title") or raw["situationId"]),
        priority=int(raw.get("priority") or 0),
        when=_when(raw.get("when")),
        steps=[_step(s) for s in raw.get("steps") or []],
        notes=str(raw.get("notes") or ""),
    )


def load_book(path: Path | None = None) -> ComboBook:
    global _cache
    src = path or book_json_path()
    mtime = src.stat().st_mtime
    if _cache and _cache[0] == mtime and path is None:
        return _cache[1]
    data = json.loads(src.read_text(encoding="utf-8"))
    book = ComboBook(
        deckId=str(data.get("deckId") or "toon-2026"),
        situations=[_situation(s) for s in data.get("situations") or []],
    )
    if path is None:
        _cache = (mtime, book)
    return book


def situation_by_id(situation_id: str, path: Path | None = None) -> BookSituation | None:
    for sit in load_book(path).situations:
        if sit.situationId == situation_id:
            return sit
    return None
