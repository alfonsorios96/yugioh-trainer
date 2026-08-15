"""Human labels for activate/select/announce/chain/option prompts."""

from __future__ import annotations

from .cards import (
    ASH,
    COMIC_CAT,
    FUNNY_DARK_RABBIT,
    MIND_SCAN,
    PERFECT_WORLD,
    TOON_TERROR,
    card_name,
)
from .types import DecisionRequest, LegalAction

# WindBot Util.GetStringId(id, n) is typically id * 16 + n.
EFFECT_INDEX_LABELS: dict[tuple[int, int], str] = {
    (PERFECT_WORLD, 0): "Perfect World — tratar como Toon World",
    (PERFECT_WORLD, 1): "Perfect World — buscar",
    (PERFECT_WORLD, 2): "Perfect World — reciclar / blink",
    (FUNNY_DARK_RABBIT, 0): "Funny Dark Rabbit — Normal Summon extra",
    (FUNNY_DARK_RABBIT, 1): "Funny Dark Rabbit — colocar Perfect World",
    (COMIC_CAT, 0): "Comic Cat — tributar e invocar Toon",
    (MIND_SCAN, 0): "Mind Scan — revelar y nombrar",
    (TOON_TERROR, 0): "Toon Terror — negar",
}

KIND_PREFIX = {
    "summon": "Invocar",
    "spsummon": "Invocar especial",
    "activate": "Activar",
    "set": "Colocar",
    "select": "Elegir",
    "announce": "Nombrar",
    "chain": "Cadena",
    "option": "Opción",
    "to_ep": "Pasar turno",
    "repos": "Cambiar posición",
}


def effect_index(desc: int | None) -> int | None:
    if desc is None:
        return None
    return int(desc) % 16


def action_label(action: LegalAction) -> str:
    if action.label:
        return action.label
    if action.id in ("to-ep", "to_ep") or action.kind == "to_ep":
        return "Pasar turno"
    if action.id in ("chain-pass", "select-skip"):
        return "Pasar" if action.id == "chain-pass" else "Cancelar selección"
    if action.kind == "option":
        idx = action.optionIndex if action.optionIndex is not None else 0
        return f"Opción {idx + 1}"
    name = card_name(action.cardId)
    if action.kind == "activate" and action.desc is not None:
        idx = effect_index(action.desc)
        mapped = EFFECT_INDEX_LABELS.get((action.cardId or 0, idx or 0))
        if mapped:
            return mapped
        return f"Activar {name} (efecto {idx})"
    prefix = KIND_PREFIX.get(action.kind, action.kind)
    if action.cardId:
        return f"{prefix} {name}"
    return prefix


def enrich_legal_labels(req: DecisionRequest) -> None:
    for action in req.legalActions:
        action.label = action_label(action)
