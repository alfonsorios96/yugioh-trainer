from __future__ import annotations

from .cards import ASH, FUWALOS, MAXX_C
from .types import DecisionRequest, PlayerState

_THREAT_CARDS: dict[int, str] = {
    FUWALOS: "fuwalos",
    MAXX_C: "maxx-c",
    ASH: "ash",
}
_THREAT_TO_CARD: dict[str, int] = {name: cid for cid, name in _THREAT_CARDS.items()}


def _visible_ids(player: PlayerState) -> set[int]:
    return set(player.hand) | set(player.grave) | set(player.banished) | set(player.monsters)


def infer_threats(req: DecisionRequest) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for name in req.threats:
        key = name.lower()
        if key not in seen:
            seen.add(key)
            found.append(key)
    opp_ids = _visible_ids(req.opp)
    for card_id in opp_ids:
        name = _THREAT_CARDS.get(card_id)
        if name and name not in seen:
            seen.add(name)
            found.append(name)
    kept: list[str] = []
    for name in found:
        card_id = _THREAT_TO_CARD.get(name)
        if card_id is not None and card_id not in opp_ids:
            continue
        kept.append(name)
    return kept


def apply_threats(req: DecisionRequest) -> list[str]:
    req.threats = infer_threats(req)
    return req.threats
