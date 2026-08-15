from __future__ import annotations

from pathlib import Path

from .cards import card_name
from .labels import action_label
from .log import utc_now
from .paths import duels_dir
from .types import DecisionProposal, DecisionRequest, DecisionResponse, UserChoice


def duel_log_path(duel_id: str, deck_id: str = "toon-2026") -> Path:
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in duel_id) or "duel"
    return duels_dir(deck_id) / f"{safe}.md"


def _ids(values: list[int]) -> str:
    if not values:
        return "—"
    return ", ".join(f"{card_name(i)} (`{i}`)" for i in values if i)


def _header(request: DecisionRequest) -> str:
    return "\n".join(
        [
            f"# Duelo `{request.duelId}`",
            "",
            f"- Deck: `{request.deckId}`",
            f"- Going: {request.going}",
            f"- Inicio: {utc_now()}",
            "",
        ]
    )


def _legal_line(request: DecisionRequest) -> list[str]:
    lines = ["- Acciones legales:"]
    if not request.legalActions:
        lines.append("  - (ninguna)")
        return lines
    for action in request.legalActions:
        label = action.label or action_label(action)
        extra = f" desc={action.desc}" if action.desc is not None else ""
        lines.append(f"  - `{action.id}` {action.kind} {label}{extra}")
    return lines


def _top5_lines(proposal: DecisionProposal) -> list[str]:
    lines = ["- Top-5:"]
    for i, action in enumerate(proposal.top5, 1):
        lines.append(
            f"  {i}. {action.kind} {action.label or card_name(action.cardId)} "
            f"({action.score:.1f}) — {action.why}"
        )
    return lines


def append_duel_decision(
    request: DecisionRequest,
    proposal: DecisionProposal,
    choice: UserChoice,
    response: DecisionResponse,
    *,
    step_no: int,
) -> Path:
    path = duel_log_path(request.duelId, request.deckId)
    new_file = not path.is_file()
    chosen = next((a for a in request.legalActions if a.id == choice.actionId), None)
    label = (
        action_label(chosen)
        if chosen
        else card_name(response.cardId) if response.cardId else choice.actionId
    )
    diverged = bool(proposal.top5) and choice.actionId != proposal.top5[0].actionId
    source = response.source
    lines = []
    if new_file:
        lines.append(_header(request))
    book_bit = ""
    if response.stepIndex is not None:
        total = response.bookSteps or "?"
        book_bit = f" · paso {response.stepIndex + 1}/{total}"
    lines.extend(
        [
            f"## Paso {step_no} — T{request.turn} {request.phase} `{request.promptKind}`",
            "",
            f"- Fuente: **{source}**{book_bit}",
            f"- Situación: `{response.situationId or 'unknown'}` ({response.mode})",
            f"- Acción: **{label}** (`{choice.actionId}`)",
            f"- Por qué: {proposal.top5[0].why if proposal.top5 else '—'}",
        ]
    )
    if diverged:
        suggested = proposal.top5[0].actionId if proposal.top5 else "—"
        lines.append(f"- Corrección humana: divergió de `{suggested}`")
    if choice.note:
        lines.append(f"- Nota: {choice.note}")
    lines.extend(
        [
            f"- Mano: {_ids(request.self.hand)}",
            f"- Monstruos: {_ids(request.self.monsters)}",
            f"- Magias: {_ids(request.self.spells)}",
            f"- Cementerio: {_ids(request.self.grave)}",
            f"- Extra: {_ids(request.self.extra)}",
            f"- Amenazas: {', '.join(request.threats) or 'ninguna'}",
            f"- Constraints: NS usada={request.constraints.normalSummonUsed}, "
            f"summons={request.constraints.summonCount}, "
            f"selectRole={request.constraints.selectRole or '—'}, "
            f"chainPlayer={request.constraints.chainPlayer if request.constraints.chainPlayer is not None else '—'}",
        ]
    )
    lines.extend(_legal_line(request))
    lines.extend(_top5_lines(proposal))
    lines.append("")
    with path.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    return path
