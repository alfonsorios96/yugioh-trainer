from __future__ import annotations

from dataclasses import dataclass

from .book import BookSituation, BookStep, load_book
from .cards import (
    ANIMA,
    BAGOOSKA,
    BLUE_EYES_TOON,
    CHARMER_QUARTET,
    COMIC_CAT,
    CROSS_SHEEP,
    DUGARES,
    FACELESS_MAGE,
    FIREWALL,
    FUNNY_DARK_RABBIT,
    MIND_SCAN,
    PERFECT_WORLD,
    PERFECTRON,
    PROTECTCODE,
    TOON_BOOKMARK,
    TOON_TABLE,
    ULTIMATE_DRAGON,
    ZEALANTIS,
    ZENNA,
    card_name,
)
from .labels import effect_index
from .types import DecisionRequest, LegalAction

EXTRA_DECK_IDS = frozenset(
    {
        DUGARES,
        ANIMA,
        CROSS_SHEEP,
        ULTIMATE_DRAGON,
        PROTECTCODE,
        FIREWALL,
        CHARMER_QUARTET,
        ZEALANTIS,
        ZENNA,
        PERFECTRON,
        BAGOOSKA,
    }
)

ABORT_THREATS = frozenset({"fuwalos", "maxx-c", "maxx"})

GLUE_KINDS = frozenset({"select", "announce", "option", "chain"})


@dataclass(frozen=True)
class LineCursor:
    situationId: str
    stepIndex: int


@dataclass
class FollowHit:
    action: LegalAction
    situationId: str
    stepIndex: int
    bookSteps: int
    why: str
    advance: bool


def _hand(req: DecisionRequest) -> set[int]:
    return set(req.self.hand)


def _field(req: DecisionRequest) -> set[int]:
    return set(req.self.monsters) | set(req.self.spells)


def _used(req: DecisionRequest) -> set[int]:
    return (
        set(req.self.monsters)
        | set(req.self.spells)
        | set(req.self.grave)
        | set(req.self.banished)
    )


def _threats(req: DecisionRequest) -> set[str]:
    return {t.lower() for t in req.threats}


def should_abort_book(req: DecisionRequest) -> bool:
    threats = _threats(req)
    if "fuwalos" in threats and req.going == "first" and req.turn <= 1:
        return True
    if threats & ABORT_THREATS - {"fuwalos"}:
        return True
    return False


def opening_matches(sit: BookSituation, req: DecisionRequest) -> bool:
    when = sit.when
    if when.going and when.going != req.going:
        return False
    hand = _hand(req)
    if when.handContains and not all(cid in hand for cid in when.handContains):
        return False
    if when.handExcludes and any(cid in hand for cid in when.handExcludes):
        return False
    if when.worldOnField is True and PERFECT_WORLD not in _field(req):
        return False
    if when.worldOnField is False and PERFECT_WORLD in _field(req):
        return False
    return True


def extra_missing(sit: BookSituation, step_index: int, req: DecisionRequest) -> bool:
    extra = [cid for cid in req.self.extra if cid > 0]
    if not extra:
        return False
    extra_set = set(extra)
    used = _used(req)
    for step in sit.steps[step_index:]:
        if step.kind != "spsummon" or step.cardId not in EXTRA_DECK_IDS:
            continue
        if step.cardId not in used and step.cardId not in extra_set:
            return True
    return False


def _activate_count(sit: BookSituation, card_id: int, before: int) -> int:
    return sum(
        1
        for step in sit.steps[:before]
        if step.kind == "activate" and step.cardId == card_id
    )


def _summon_count(sit: BookSituation, card_id: int, before: int) -> int:
    return sum(
        1
        for step in sit.steps[:before]
        if step.kind in ("summon", "spsummon") and step.cardId == card_id
    )


def step_plausibly_done(sit: BookSituation, index: int, req: DecisionRequest) -> bool:
    step = sit.steps[index]
    used = _used(req)
    field = _field(req)
    hand = _hand(req)
    if step.kind in ("summon", "spsummon", "set"):
        if _summon_count(sit, step.cardId, index) == 0:
            return step.cardId in used
        return step.cardId in field
    if step.kind != "activate":
        return False
    cid = step.cardId
    if cid == FUNNY_DARK_RABBIT:
        prior = _activate_count(sit, FUNNY_DARK_RABBIT, index)
        if prior == 0:
            return PERFECT_WORLD in field
        return req.constraints.summonCount >= 2
    if cid == PERFECT_WORLD:
        return PERFECT_WORLD in field
    if cid == FACELESS_MAGE:
        return MIND_SCAN in hand or MIND_SCAN in field or MIND_SCAN in req.self.grave
    if cid == COMIC_CAT:
        return COMIC_CAT in req.self.grave or BLUE_EYES_TOON in used or (
            FUNNY_DARK_RABBIT in used and COMIC_CAT in used
        )
    if cid in (TOON_TABLE, TOON_BOOKMARK):
        return cid in used
    if cid == MIND_SCAN:
        return MIND_SCAN in field or MIND_SCAN in req.self.grave
    return cid in used


def prefix_length(sit: BookSituation, req: DecisionRequest) -> int:
    n = 0
    for i in range(len(sit.steps)):
        if not step_plausibly_done(sit, i, req):
            break
        n += 1
    return n


def _legal_matches(step: BookStep, legal: list[LegalAction]) -> list[LegalAction]:
    return [
        action
        for action in legal
        if action.kind == step.kind and action.cardId == step.cardId
    ]


def _pick_activate(
    step: BookStep,
    sit: BookSituation,
    step_index: int,
    req: DecisionRequest,
    candidates: list[LegalAction],
) -> LegalAction | None:
    if not candidates:
        return None
    if step.effectIndex is not None:
        for action in candidates:
            if effect_index(action.desc) == step.effectIndex:
                return action
    if len(candidates) == 1 or step.cardId != PERFECT_WORLD:
        if step.place:
            placed = [a for a in candidates if a.place == step.place]
            if placed:
                return placed[0]
        return candidates[0]
    remaining = sit.steps[step_index + 1 :]
    have = _hand(req) | _field(req)
    grave = set(req.self.grave)
    next_step = remaining[0] if remaining else None
    recycle = bool(
        next_step
        and next_step.kind == "spsummon"
        and next_step.cardId in grave
    )
    need_search = any(
        s.cardId not in have
        and s.cardId not in EXTRA_DECK_IDS
        and s.kind in ("activate", "summon", "spsummon", "set")
        for s in remaining[:4]
    )
    for action in candidates:
        idx = effect_index(action.desc)
        if recycle and idx == 2:
            return action
        if need_search and idx == 1:
            return action
    for action in candidates:
        if effect_index(action.desc) == 1:
            return action
    return candidates[0]


def match_step_action(
    sit: BookSituation,
    step_index: int,
    req: DecisionRequest,
) -> LegalAction | None:
    if step_index >= len(sit.steps):
        return None
    step = sit.steps[step_index]
    candidates = _legal_matches(step, req.legalActions)
    if step.kind == "activate":
        return _pick_activate(step, sit, step_index, req, candidates)
    if step.place:
        placed = [a for a in candidates if a.place == step.place]
        if placed:
            return placed[0]
    return candidates[0] if candidates else None


def _next_summon_step(sit: BookSituation, step_index: int) -> BookStep | None:
    for step in sit.steps[step_index:]:
        if step.kind in ("spsummon", "summon"):
            return step
    return None


def _glue_action(sit: BookSituation, step_index: int, req: DecisionRequest) -> LegalAction | None:
    kind = req.promptKind
    if kind == "chain":
        return None
    if kind == "select":
        role = req.constraints.selectRole
        if role == "tribute":
            for action in req.legalActions:
                if action.kind == "select" and action.cardId == COMIC_CAT:
                    return action
        target = _next_summon_step(sit, step_index)
        if target is None:
            return None
        for action in req.legalActions:
            if action.kind == "select" and action.cardId == target.cardId:
                return action
        return None
    if kind == "announce":
        return None
    if kind == "option":
        if FUNNY_DARK_RABBIT in set(req.self.monsters) and PERFECT_WORLD not in _field(req):
            custom = [
                a
                for a in req.legalActions
                if a.kind == "option" and a.desc is not None and a.desc >= 10_000
            ]
            if custom:
                return custom[0]
        return None
    return None


def _score_candidate(sit: BookSituation, prefix: int, opening: bool) -> int:
    return sit.priority * 100 + prefix + (5 if opening else 0)


def _hit_for(
    sit: BookSituation,
    step_index: int,
    req: DecisionRequest,
    action: LegalAction,
    *,
    advance: bool,
    glue: bool = False,
) -> FollowHit:
    step = sit.steps[step_index] if step_index < len(sit.steps) else None
    label = action.label or card_name(action.cardId)
    if glue:
        why = f"Libro: paso {step_index + 1}/{len(sit.steps)} — elegir {label}"
    else:
        name = card_name(step.cardId) if step else label
        why = f"Libro: paso {step_index + 1}/{len(sit.steps)} — {step.kind if step else action.kind} {name}"
    return FollowHit(
        action=action,
        situationId=sit.situationId,
        stepIndex=step_index,
        bookSteps=len(sit.steps),
        why=why,
        advance=advance,
    )


def follow_book(
    req: DecisionRequest,
    cursor: LineCursor | None = None,
    *,
    book=None,
) -> FollowHit | None:
    if should_abort_book(req):
        return None
    if req.promptKind == "chain":
        return None
    combo = book or load_book()
    situations = {s.situationId: s for s in combo.situations}

    if cursor and cursor.situationId in situations:
        sit = situations[cursor.situationId]
        if extra_missing(sit, cursor.stepIndex, req):
            return None
        action = match_step_action(sit, cursor.stepIndex, req)
        if action is not None:
            return _hit_for(sit, cursor.stepIndex, req, action, advance=True)
        if req.promptKind in GLUE_KINDS:
            glued = _glue_action(sit, cursor.stepIndex, req)
            if glued is not None:
                return _hit_for(sit, cursor.stepIndex, req, glued, advance=False, glue=True)
        return None

    best: tuple[int, FollowHit] | None = None
    for sit in combo.situations:
        prefix = prefix_length(sit, req)
        opening = prefix == 0
        if opening and not opening_matches(sit, req):
            continue
        if extra_missing(sit, prefix, req):
            continue
        action = match_step_action(sit, prefix, req)
        if action is not None:
            hit = _hit_for(sit, prefix, req, action, advance=True)
            score = _score_candidate(sit, prefix, opening)
            if best is None or score > best[0]:
                best = (score, hit)
            continue
        if prefix > 0 and req.promptKind in GLUE_KINDS:
            glued = _glue_action(sit, prefix, req)
            if glued is not None:
                hit = _hit_for(sit, prefix, req, glued, advance=False, glue=True)
                score = _score_candidate(sit, prefix, False)
                if best is None or score > best[0]:
                    best = (score, hit)
    return best[1] if best else None
