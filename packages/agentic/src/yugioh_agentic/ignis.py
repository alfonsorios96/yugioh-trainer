from __future__ import annotations

import json
import sqlite3
import urllib.request
from pathlib import Path

from .cards import CARD_NAMES, card_name

GITHUB_RAW = (
    "https://raw.githubusercontent.com/ProjectIgnis/CardScripts/master/official/c{id}.lua"
)


def script_candidates(edo_pro_root: str | None, card_id: int) -> list[Path]:
    if not edo_pro_root:
        return []
    root = Path(edo_pro_root)
    name = f"c{card_id}.lua"
    return [
        root / "repositories" / "delta-bagooska" / "script" / "official" / name,
        root / "script" / "official" / name,
    ]


def read_lua_header(path: Path) -> dict[str, str]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    comments = [ln[2:].strip() for ln in lines[:12] if ln.startswith("--")]
    english = comments[1] if len(comments) > 1 else (comments[0] if comments else path.stem)
    return {
        "path": str(path),
        "name": english,
        "header": "\n".join(comments[:8]),
    }


def lookup_card(card_id: int, edo_pro_root: str | None = None) -> dict[str, str]:
    for path in script_candidates(edo_pro_root, card_id):
        if path.is_file():
            info = read_lua_header(path)
            info["source"] = "local-lua"
            return info
    if edo_pro_root:
        for cdb in (
            Path(edo_pro_root) / "cards.cdb",
            Path(edo_pro_root) / "repositories" / "delta-bagooska" / "cards.delta.cdb",
        ):
            name = _cdb_name(cdb, card_id)
            if name:
                return {"name": name, "source": "cdb", "path": str(cdb), "header": ""}
    return {
        "name": card_name(card_id),
        "source": "builtin" if card_id in CARD_NAMES else "unknown",
        "path": "",
        "header": "",
    }


def _cdb_name(cdb: Path, card_id: int) -> str | None:
    if not cdb.is_file():
        return None
    try:
        con = sqlite3.connect(f"file:{cdb}?mode=ro", uri=True)
        try:
            row = con.execute(
                "SELECT name FROM texts WHERE id = ?", (card_id,)
            ).fetchone()
            return str(row[0]) if row and row[0] else None
        finally:
            con.close()
    except sqlite3.Error:
        return None


def fetch_github_script(card_id: int, timeout: float = 4.0) -> dict[str, str] | None:
    url = GITHUB_RAW.format(id=card_id)
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", errors="replace")
    except OSError:
        return None
    comments = [ln[2:].strip() for ln in text.splitlines()[:12] if ln.startswith("--")]
    english = comments[1] if len(comments) > 1 else (comments[0] if comments else f"c{card_id}")
    return {"name": english, "source": "github", "path": url, "header": "\n".join(comments[:8])}


def format_lookup(info: dict[str, str]) -> str:
    return json.dumps(info, ensure_ascii=False)
