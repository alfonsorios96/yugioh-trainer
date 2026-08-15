from __future__ import annotations

from .cards import (
    ASH,
    BLUE_EYES_TOON,
    COMIC_CAT,
    COMIC_CAT_BAD_SS,
    EVIL_BOX,
    FACELESS_MAGE,
    FUNNY_DARK_RABBIT,
    IMPERM,
    MIND_SCAN,
    NIBIRU,
    PERFECT_WORLD,
    SAFE_FUWALOS,
    SEARCHERS,
    TOON_TERROR,
    VEILER,
    card_name,
    is_searcher,
)
from .types import DecisionRequest, LegalAction, Mode, RankedAction

SITUATION_RABBIT = "first-going-funny-dark-rabbit-no-extenders"
SITUATION_CAT = "first-going-comic-cat-no-extenders"
SITUATION_SEARCHER = "first-going-searcher-into-line"
SITUATION_FUWALOS = "first-turn-fuwalos-safe-pass"
SITUATION_ASH = "ash-on-perfect-world-search"
SITUATION_SECOND = "going-second-improvise"
SITUATION_CLOSE = "close-combo-set-terror"
SITUATION_ANNOUNCE = "mind-scan-announce"
SITUATION_MAXX = "maxx-c-no-overextend"

TARGET_BOARDS = {
    SITUATION_RABBIT: "Rabbit gold: Perfectron EMZ, Charmer MZ1, Box MZ4, Cat MZ5, World, Mind Scan, Terror set",
    SITUATION_CAT: "Cat acceptable: Perfectron, Charmer, Cat, World, Mind Scan, Terror set (no Evil Box)",
    SITUATION_SEARCHER: "Search into Rabbit or Comic Cat gold line",
    SITUATION_FUWALOS: "Safe: Comic Cat + Evil Box + Mind Scan + Toon Terror + Perfect World, then pass",
    SITUATION_ASH: "Recover: Mind Scan / Terror / leftover Rabbit, do not empty the turn",
    SITUATION_SECOND: "Acceptable break board, not first-going gold",
    SITUATION_CLOSE: "Set Toon Terror and end",
    SITUATION_ANNOUNCE: "Name the interruption that hurts this turn most",
    SITUATION_MAXX: "Stop extending; set or pass",
}


def _hand(req: DecisionRequest) -> set[int]:
    return set(req.self.hand)


def _field(req: DecisionRequest) -> set[int]:
    return set(req.self.monsters) | set(req.self.spells)


def _has_threat(req: DecisionRequest, *names: str) -> bool:
    lowered = {t.lower() for t in req.threats}
    return any(n.lower() in lowered for n in names)


def classify(req: DecisionRequest) -> tuple[str | None, Mode]:
    if req.promptKind == "announce":
        return SITUATION_ANNOUNCE, "follow"
    if _has_threat(req, "fuwalos") and req.going == "first" and req.turn <= 1:
        return SITUATION_FUWALOS, "safe-pass"
    if _has_threat(req, "maxx-c", "maxx"):
        return SITUATION_MAXX, "safe-pass"
    if req.going == "second":
        return SITUATION_SECOND, "improvise"
    if _has_threat(req, "ash") and (
        PERFECT_WORLD in _field(req) or _has_threat(req, "ash-world", "ash-search")
    ):
        return SITUATION_ASH, "improvise"

    field = _field(req)
    terror_ready = TOON_TERROR in field or TOON_TERROR in req.self.grave
    world_up = PERFECT_WORLD in field
    scan_up = MIND_SCAN in field
    if (
        req.promptKind == "idle"
        and world_up
        and scan_up
        and (COMIC_CAT in field or FUNNY_DARK_RABBIT in field)
        and (TOON_TERROR in _hand(req) or terror_ready)
        and len(req.self.monsters) >= 2
    ):
        return SITUATION_CLOSE, "follow"

    hand = _hand(req)
    if FUNNY_DARK_RABBIT in hand and req.going == "first":
        return SITUATION_RABBIT, "follow"
    if COMIC_CAT in hand and FUNNY_DARK_RABBIT not in hand and req.going == "first":
        return SITUATION_CAT, "follow"
    if hand & SEARCHERS and FUNNY_DARK_RABBIT not in hand and COMIC_CAT not in hand:
        return SITUATION_SEARCHER, "follow"
    return None, "improvise"


def _score_action(req: DecisionRequest, action: LegalAction, situation: str | None) -> tuple[float, str]:
    kind = action.kind
    cid = action.cardId
    role = req.constraints.selectRole

    if req.promptKind == "announce" or situation == SITUATION_ANNOUNCE:
        return _score_announce(req, action)
    if req.promptKind == "select" or kind == "select":
        return _score_select(req, action, situation, role)

    if situation == SITUATION_FUWALOS:
        return _score_fuwalos(req, action)
    if situation == SITUATION_MAXX:
        return _score_maxx(action)
    if situation == SITUATION_SECOND:
        return _score_second(action)
    if situation == SITUATION_ASH:
        return _score_ash(action)
    if situation == SITUATION_CLOSE:
        return _score_close(action)
    if situation == SITUATION_RABBIT:
        return _score_rabbit(action)
    if situation == SITUATION_CAT:
        return _score_cat_idle(action)
    if situation == SITUATION_SEARCHER:
        return _score_searcher(action)
    return _score_default(action)


def _score_rabbit(action: LegalAction) -> tuple[float, str]:
    if action.kind == "summon" and action.cardId == FUNNY_DARK_RABBIT:
        return 100.0, "Libro: NS Funny Dark Rabbit primero"
    if action.kind == "summon" and action.cardId == COMIC_CAT:
        return 35.0, "Cat es opener de reserva; Rabbit tiene prioridad"
    if action.kind == "activate" and is_searcher(action.cardId):
        return 8.0, "Searcher no se activa antes del NS Rabbit"
    if action.kind == "activate" and action.cardId == PERFECT_WORLD:
        return 12.0, "World espera al NS Rabbit"
    if action.kind == "to_ep":
        return 1.0, "Pasar vacía el turno"
    return _score_default(action)


def _score_cat_idle(action: LegalAction) -> tuple[float, str]:
    if action.kind == "summon" and action.cardId == COMIC_CAT:
        return 100.0, "Libro: NS Comic Cat (sin Rabbit)"
    if action.kind == "activate" and is_searcher(action.cardId):
        return 20.0, "Searcher por debajo del NS Cat"
    if action.kind == "summon" and action.cardId == FUNNY_DARK_RABBIT:
        return 90.0, "Rabbit en mano cambiaría de línea"
    if action.kind == "to_ep":
        return 1.0, "Pasar vacía el turno"
    return _score_default(action)


def _score_searcher(action: LegalAction) -> tuple[float, str]:
    if action.kind == "activate" and is_searcher(action.cardId):
        return 100.0, "Solo searcher: buscar Rabbit o Cat"
    if action.kind == "to_ep":
        return 2.0, "Pasar sin buscar"
    return _score_default(action)


def _score_fuwalos(req: DecisionRequest, action: LegalAction) -> tuple[float, str]:
    field = _field(req)
    hand = _hand(req)
    have = field | (hand if action.kind != "to_ep" else field)
    safe_on_field = SAFE_FUWALOS.issubset(field | ({TOON_TERROR} if TOON_TERROR in field else set()))
    terror_set = TOON_TERROR in field
    pieces = {COMIC_CAT, EVIL_BOX, MIND_SCAN, PERFECT_WORLD}
    if pieces.issubset(field) and terror_set and action.kind == "to_ep":
        return 100.0, "Campo seguro listo: pasar (rival a −1 de robo)"
    if action.kind == "to_ep" and pieces.issubset(field | hand) and terror_set:
        return 95.0, "Campo seguro: declarar fin"
    if action.kind == "to_ep":
        return 25.0, "Pasar solo cuando el seguro está puesto"
    if action.kind == "summon" and action.cardId == COMIC_CAT:
        return 88.0, "Seguro Fuwalos: NS Comic Cat"
    if action.kind == "activate" and action.cardId in (EVIL_BOX, MIND_SCAN, PERFECT_WORLD):
        return 84.0, f"Seguro Fuwalos: {card_name(action.cardId)}"
    if action.kind == "set" and action.cardId == TOON_TERROR:
        return 90.0, "Seguro Fuwalos: set Toon Terror"
    if action.kind == "activate" and action.cardId == TOON_TERROR:
        return 70.0, "Terror en el seguro"
    if action.kind in ("spsummon",) or (
        action.kind == "activate" and action.cardId in (FACELESS_MAGE,)
    ):
        return 5.0, "No extender bajo Fuwalos"
    return _score_default(action)


def _score_maxx(action: LegalAction) -> tuple[float, str]:
    if action.kind == "to_ep":
        return 100.0, "Maxx C: no overextend, pasar"
    if action.kind == "set" and action.cardId == TOON_TERROR:
        return 80.0, "Set Terror y parar"
    if action.kind == "spsummon":
        return 2.0, "Summon extra da cartas al rival"
    return _score_default(action)


def _score_second(action: LegalAction) -> tuple[float, str]:
    if action.kind == "activate" and action.cardId in (IMPERM, VEILER, ASH, 40366667):
        return 92.0, "Going second: breaker antes que el combo oro"
    if action.kind == "summon" and action.cardId == FUNNY_DARK_RABBIT:
        return 40.0, "Rabbit no es la prioridad vs board rival"
    if action.kind == "to_ep":
        return 10.0, "Aún hay interacción"
    return _score_default(action)


def _score_ash(action: LegalAction) -> tuple[float, str]:
    if action.kind == "activate" and action.cardId == MIND_SCAN:
        return 100.0, "Ash al search: seguir con Mind Scan"
    if action.kind == "set" and action.cardId == TOON_TERROR:
        return 85.0, "Ash al search: set Terror"
    if action.kind == "activate" and action.cardId == FUNNY_DARK_RABBIT:
        return 70.0, "Reciclar Rabbit si aún es legal"
    if action.kind == "to_ep":
        return 15.0, "No vaciar el turno si queda línea"
    return _score_default(action)


def _score_close(action: LegalAction) -> tuple[float, str]:
    if action.kind == "set" and action.cardId == TOON_TERROR:
        return 100.0, "Cierre: set Toon Terror"
    if action.kind == "to_ep":
        return 70.0, "Cierre: pasar si Terror ya está"
    if action.kind == "spsummon":
        return 6.0, "No extender el endBoard"
    return _score_default(action)


def _score_announce(req: DecisionRequest, action: LegalAction) -> tuple[float, str]:
    cid = action.cardId
    summons = req.constraints.summonCount
    if cid == NIBIRU and summons >= 4:
        return 100.0, "5º summon: nombrar Nibiru"
    if cid == NIBIRU:
        return 70.0, "Nibiru es la amenaza de extra summons"
    if cid == ASH:
        return 80.0 if summons < 4 else 60.0, "Ash niega el search clave"
    if cid == VEILER:
        return 50.0, "Veiler en board vacío es peor que Nibiru/Ash"
    if cid == IMPERM:
        return 45.0, "Imperm si el campo está vacío"
    return 20.0, "Announce legal"


def _score_select(
    req: DecisionRequest,
    action: LegalAction,
    situation: str | None,
    role: str | None,
) -> tuple[float, str]:
    cid = action.cardId
    if role == "tribute" or (situation == SITUATION_CAT and role != "summon_target"):
        if cid == COMIC_CAT:
            return 100.0, "Tribute: Comic Cat a sí mismo"
        if cid == FUNNY_DARK_RABBIT:
            return 5.0, "Rabbit no es el tribute"
        return 8.0, "Tribute incorrecto"
    if role == "summon_target" or situation == SITUATION_CAT:
        if cid == FUNNY_DARK_RABBIT:
            return 100.0, "SS Funny Dark Rabbit (no Blue-Eyes, no Evil Box)"
        if cid in COMIC_CAT_BAD_SS:
            return 2.0, f"No SS {card_name(cid)} con Comic Cat"
        return 15.0, "Otro Toon legal, peor que Rabbit"
    if cid == FUNNY_DARK_RABBIT:
        return 80.0, "Select Rabbit"
    return _score_default(action)


def _score_default(action: LegalAction) -> tuple[float, str]:
    if action.kind == "to_ep":
        return 10.0, "Pasar turno"
    if action.kind == "summon":
        return 30.0, f"NS {card_name(action.cardId)}"
    if action.kind == "activate":
        return 28.0, f"Activar {card_name(action.cardId)}"
    if action.kind == "set":
        return 24.0, f"Set {card_name(action.cardId)}"
    if action.kind == "spsummon":
        return 22.0, f"SS {card_name(action.cardId)}"
    return 15.0, action.kind


def rank(req: DecisionRequest) -> tuple[list[RankedAction], str | None, Mode, dict[str, float]]:
    situation, mode = classify(req)
    ranked: list[RankedAction] = []
    scores: dict[str, float] = {}
    for action in req.legalActions:
        score, why = _score_action(req, action, situation)
        scores[action.id] = score
        ranked.append(
            RankedAction(
                actionId=action.id,
                kind=action.kind,
                cardId=action.cardId,
                score=score,
                why=why,
                label=action.label or card_name(action.cardId) if action.cardId else action.kind,
            )
        )
    ranked.sort(key=lambda r: (-r.score, r.actionId))
    return ranked, situation, mode, scores


def top5(req: DecisionRequest) -> tuple[list[RankedAction], str | None, Mode, dict[str, float]]:
    ranked, situation, mode, scores = rank(req)
    return ranked[:5], situation, mode, scores
