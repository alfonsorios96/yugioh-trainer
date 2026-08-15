from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .paths import memory_dir
from .types import to_dict


def _append(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def append_event(record: dict[str, Any], deck_id: str = "toon-2026") -> Path:
    path = memory_dir(deck_id) / "events.jsonl"
    _append(path, record)
    return path


def append_preference(record: dict[str, Any], deck_id: str = "toon-2026") -> Path:
    path = memory_dir(deck_id) / "preferences.jsonl"
    _append(path, record)
    return path


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    out: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def dump(obj: Any) -> Any:
    return to_dict(obj)
