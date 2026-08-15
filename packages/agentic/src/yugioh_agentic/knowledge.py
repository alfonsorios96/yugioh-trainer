from __future__ import annotations

from pathlib import Path

from .paths import agents_dir, deck_dir


def _read_md(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def load_markdown(deck_id: str = "toon-2026") -> dict[str, str]:
    """Load every .md under shared/ and the deck folder. Keys are relative paths."""
    out: dict[str, str] = {}
    roots = [agents_dir() / "shared", deck_dir(deck_id)]
    for root in roots:
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*.md")):
            rel = str(path.relative_to(root.parent if root.name != "shared" else root.parent))
            out[rel] = _read_md(path)
    return out


def assemble_prompt_context(deck_id: str = "toon-2026", limit: int = 12000) -> tuple[str, list[str]]:
    docs = load_markdown(deck_id)
    used: list[str] = []
    chunks: list[str] = []
    total = 0
    preferred = (
        f"{deck_id}/AGENT.md",
        f"{deck_id}/rules/openers.md",
        f"{deck_id}/rules/interruptions.md",
        f"{deck_id}/rules/end-boards.md",
        f"{deck_id}/rules/constraints.md",
        "shared/rules/tcg-phases.md",
        "shared/rules/chain-and-opt.md",
        f"{deck_id}/resources/book.md",
    )
    seen: set[str] = set()
    for key in list(preferred) + sorted(docs):
        if key in seen or key not in docs:
            continue
        seen.add(key)
        text = docs[key].strip()
        if not text:
            continue
        piece = f"## {key}\n\n{text}\n"
        if total + len(piece) > limit:
            break
        chunks.append(piece)
        used.append(key)
        total += len(piece)
    return "\n".join(chunks), used
