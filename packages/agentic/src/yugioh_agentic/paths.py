from __future__ import annotations

from pathlib import Path

_memory_override: Path | None = None
_generated_override: Path | None = None


def set_test_dirs(memory: Path | None = None, generated: Path | None = None) -> None:
    global _memory_override, _generated_override
    _memory_override = memory
    _generated_override = generated


def repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "agents").is_dir() and (parent / "package.json").exists():
            return parent
    raise FileNotFoundError("Cannot find repo root (agents/ + package.json)")


def agents_dir() -> Path:
    return repo_root() / "agents"


def deck_dir(deck_id: str = "toon-2026") -> Path:
    return agents_dir() / deck_id


def book_json_path() -> Path:
    return (
        repo_root()
        / "packages"
        / "windbot-engines"
        / "combos"
        / "toon-2026"
        / "book.json"
    )


def memory_dir(deck_id: str = "toon-2026") -> Path:
    path = _memory_override or (deck_dir(deck_id) / "resources" / "memory")
    path.mkdir(parents=True, exist_ok=True)
    return path


def generated_dir(deck_id: str = "toon-2026") -> Path:
    path = _generated_override or (deck_dir(deck_id) / "resources" / "generated")
    path.mkdir(parents=True, exist_ok=True)
    return path


def duels_dir(deck_id: str = "toon-2026") -> Path:
    path = memory_dir(deck_id) / "duels"
    path.mkdir(parents=True, exist_ok=True)
    return path
