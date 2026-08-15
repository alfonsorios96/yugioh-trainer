from __future__ import annotations

import argparse
import json
from pathlib import Path

from .cards import card_name
from .log import append_preference, read_jsonl, utc_now
from .paths import generated_dir, memory_dir
from .types import DecisionProposal, DecisionRequest, UserChoice


def preference_record(
    request: DecisionRequest,
    proposal: DecisionProposal,
    choice: UserChoice,
    from_top5: bool,
) -> dict:
    top_ids = [a.actionId for a in proposal.top5]
    chosen = next((a for a in request.legalActions if a.id == choice.actionId), None)
    rejected = [
        {
            "actionId": a.actionId,
            "kind": a.kind,
            "cardId": a.cardId,
            "score": a.score,
            "why": a.why,
        }
        for a in proposal.top5
        if a.actionId != choice.actionId
    ]
    return {
        "at": utc_now(),
        "requestId": request.requestId,
        "duelId": request.duelId,
        "prompt": {
            "turn": request.turn,
            "phase": request.phase,
            "going": request.going,
            "promptKind": request.promptKind,
            "hand": request.self.hand,
            "monsters": request.self.monsters,
            "spells": request.self.spells,
            "threats": request.threats,
            "situationId": proposal.situationId,
            "mode": proposal.mode,
        },
        "chosen": {
            "actionId": choice.actionId,
            "kind": chosen.kind if chosen else None,
            "cardId": chosen.cardId if chosen else None,
            "label": card_name(chosen.cardId) if chosen and chosen.cardId else choice.actionId,
            "note": choice.note,
        },
        "rejected": rejected,
        "fromTop5": from_top5,
        "hardNegative": not from_top5,
        "top5Ids": top_ids,
    }


def write_preference(
    request: DecisionRequest,
    proposal: DecisionProposal,
    choice: UserChoice,
    from_top5: bool,
) -> dict:
    record = preference_record(request, proposal, choice, from_top5)
    append_preference(record, request.deckId)
    return record


def write_lesson_markdown(
    request: DecisionRequest,
    proposal: DecisionProposal,
    choice: UserChoice,
    from_top5: bool,
) -> Path:
    dest_dir = generated_dir(request.deckId)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = utc_now().replace(":", "").replace("-", "")[:15]
    path = dest_dir / f"lesson-{stamp}-{request.requestId[:8]}.md"
    chosen = next((a for a in request.legalActions if a.id == choice.actionId), None)
    label = card_name(chosen.cardId) if chosen and chosen.cardId else (chosen.kind if chosen else choice.actionId)
    kind = chosen.kind if chosen else "?"
    lines = [
        f"# Lección {request.requestId}",
        "",
        f"- Situación: `{proposal.situationId or 'unknown'}` ({proposal.mode})",
        f"- Turno {request.turn} {request.phase} going {request.going}",
        f"- Amenazas: {', '.join(request.threats) or 'ninguna'}",
        f"- El usuario eligió: **{kind} {label}** (`{choice.actionId}`)",
        f"- Venía del top-5: {'sí' if from_top5 else 'no (Otra / hard negative)'}",
    ]
    if choice.note:
        lines.append(f"- Nota: {choice.note}")
    lines.append("")
    lines.append("Top-5 del ranker:")
    for i, action in enumerate(proposal.top5, 1):
        mark = " ← chosen" if action.actionId == choice.actionId else ""
        lines.append(f"{i}. {action.kind} {card_name(action.cardId)} ({action.score:.1f}) — {action.why}{mark}")
    lines.append("")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def maybe_write_lesson(
    request: DecisionRequest,
    proposal: DecisionProposal,
    choice: UserChoice,
    from_top5: bool,
    every: int = 1,
) -> Path | None:
    if every <= 0:
        return None
    return write_lesson_markdown(request, proposal, choice, from_top5)


def export_finetune(deck_id: str = "toon-2026", dest: Path | None = None) -> Path:
    src = memory_dir(deck_id) / "preferences.jsonl"
    dest = dest or (memory_dir(deck_id) / "finetune.jsonl")
    rows = []
    for pref in read_jsonl(src):
        rows.append(
            {
                "prompt": json.dumps(pref.get("prompt", {}), ensure_ascii=False),
                "chosen": json.dumps(pref.get("chosen", {}), ensure_ascii=False),
                "rejected": [json.dumps(r, ensure_ascii=False) for r in pref.get("rejected", [])],
            }
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    return dest


def export_main() -> None:
    parser = argparse.ArgumentParser(description="Export preferences.jsonl to DPO JSONL")
    parser.add_argument("--deck", default="toon-2026")
    parser.add_argument("-o", "--out", default="")
    args = parser.parse_args()
    dest = Path(args.out) if args.out else None
    path = export_finetune(args.deck, dest)
    print(path)
