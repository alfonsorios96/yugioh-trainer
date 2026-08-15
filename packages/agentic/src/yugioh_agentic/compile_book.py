from __future__ import annotations

import argparse
import json
from pathlib import Path

from .cards import card_name
from .paths import book_json_path, deck_dir


def _ids(values: list | None) -> str:
    if not values:
        return "—"
    return ", ".join(f"{card_name(int(i))} (`{i}`)" for i in values)


def compile_book(book_path: Path | None = None, dest: Path | None = None) -> Path:
    src = book_path or book_json_path()
    dest = dest or (deck_dir("toon-2026") / "resources" / "book.md")
    data = json.loads(src.read_text(encoding="utf-8"))
    lines = [
        f"# Libro {data.get('deckId', 'toon-2026')}",
        "",
        "Compilado desde `packages/windbot-engines/combos/toon-2026/book.json`.",
        "Bot Lab sigue siendo la fuente de autoría.",
        "",
    ]
    for sit in data.get("situations", []):
        when = sit.get("when") or {}
        lines.append(f"## {sit.get('title', sit.get('situationId'))}")
        lines.append("")
        lines.append(f"- id: `{sit.get('situationId')}`")
        lines.append(f"- going: `{when.get('going', 'any')}`")
        lines.append(f"- handContains: {_ids(when.get('handContains'))}")
        lines.append(f"- handExcludes: {_ids(when.get('handExcludes'))}")
        notes = (sit.get("notes") or "").strip()
        if notes:
            short = notes.split("\n\n")[0].replace("\n", " ")
            lines.append(f"- notas: {short[:400]}")
        steps = sit.get("steps") or []
        if steps:
            lines.append("- pasos oro:")
            for step in steps[:24]:
                place = f" @{step['place']}" if step.get("place") else ""
                lines.append(
                    f"  - {step.get('kind')} {card_name(int(step.get('cardId', 0)))}{place}"
                )
            if len(steps) > 24:
                lines.append(f"  - … +{len(steps) - 24} pasos")
        board = sit.get("endBoard") or {}
        lines.append(
            f"- endBoard monsters: {_ids(board.get('monsters'))}"
        )
        lines.append(f"- endBoard spells: {_ids(board.get('spells'))}")
        lines.append("")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return dest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", default="")
    parser.add_argument("-o", "--out", default="")
    args = parser.parse_args()
    path = compile_book(
        Path(args.book) if args.book else None,
        Path(args.out) if args.out else None,
    )
    print(path)
