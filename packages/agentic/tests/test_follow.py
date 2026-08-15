from __future__ import annotations

from yugioh_agentic.book import load_book
from yugioh_agentic.follow import (
    LineCursor,
    extra_missing,
    follow_book,
    opening_matches,
    should_abort_book,
)
from yugioh_agentic.ranker import top5
from yugioh_agentic.teach import TeachSession
from yugioh_agentic.threats import infer_threats
from yugioh_agentic.types import UserChoice, request_from_dict

RABBIT = 45536531
CAT = 72921536
WORLD = 7293697
FACELESS = 34314989
FUWALOS = 42141493
SIT_RABBIT = "first-going-funny-dark-rabbit-no-extenders"
SIT_CAT = "first-going-comic-cat-no-extenders"
SIT_CAT_ALT = "first-going-comic-cat-no-extenders-alternative"


def _req(**kwargs):
    base = {
        "requestId": "t",
        "duelId": "follow",
        "turn": 1,
        "phase": "MP1",
        "going": "first",
        "promptKind": "idle",
        "self": {"hand": [RABBIT], "monsters": [], "spells": []},
        "opp": {},
        "legalActions": [
            {"id": "ns-rabbit", "kind": "summon", "cardId": RABBIT},
            {"id": "to-ep", "kind": "to_ep"},
        ],
    }
    base.update(kwargs)
    return request_from_dict(base)


def test_book_start_rabbit() -> None:
    hit = follow_book(_req())
    assert hit is not None
    assert hit.situationId == SIT_RABBIT
    assert hit.stepIndex == 0
    assert hit.action.id == "ns-rabbit"
    assert hit.advance


def test_cat_priority_beats_alternative() -> None:
    book = load_book()
    cat = next(s for s in book.situations if s.situationId == SIT_CAT)
    alt = next(s for s in book.situations if s.situationId == SIT_CAT_ALT)
    req = _req(
        self={"hand": [CAT], "monsters": [], "spells": []},
        legalActions=[
            {"id": "ns-cat", "kind": "summon", "cardId": CAT},
            {"id": "to-ep", "kind": "to_ep"},
        ],
    )
    assert opening_matches(cat, req)
    assert opening_matches(alt, req)
    assert cat.priority > alt.priority
    hit = follow_book(req)
    assert hit is not None
    assert hit.situationId == SIT_CAT


def test_cursor_advances_next_step() -> None:
    req = _req(
        self={"hand": [], "monsters": [RABBIT], "spells": []},
        constraints={"normalSummonUsed": True, "summonCount": 1},
        legalActions=[
            {"id": "act-rabbit", "kind": "activate", "cardId": RABBIT},
            {"id": "to-ep", "kind": "to_ep"},
        ],
    )
    hit = follow_book(req, LineCursor(SIT_RABBIT, 1))
    assert hit is not None
    assert hit.stepIndex == 1
    assert hit.action.id == "act-rabbit"


def test_glue_select_blueeyes_on_rabbit_line() -> None:
    req = _req(
        promptKind="select",
        self={
            "hand": [53183600, RABBIT, 8915275],
            "monsters": [CAT, RABBIT],
            "spells": [WORLD, 34298391],
            "grave": [66011101, 65458948, FACELESS, 89997728],
        },
        constraints={"normalSummonUsed": True, "summonCount": 5, "selectRole": "summon_target"},
        legalActions=[
            {"id": "ss-blueeyes", "kind": "select", "cardId": 53183600},
            {"id": "ss-rabbit", "kind": "select", "cardId": RABBIT},
            {"id": "ss-box", "kind": "select", "cardId": 8915275},
        ],
    )
    hit = follow_book(req)
    assert hit is not None
    assert hit.action.id == "ss-blueeyes"
    assert hit.situationId == SIT_RABBIT


def test_drop_on_fuwalos() -> None:
    req = _req(threats=["fuwalos"])
    assert should_abort_book(req)
    assert follow_book(req) is None


def test_drop_when_next_step_not_legal() -> None:
    req = _req(
        self={"hand": [34298391], "monsters": [RABBIT], "spells": [WORLD]},
        threats=["ash"],
        constraints={"normalSummonUsed": True, "summonCount": 1},
        legalActions=[
            {"id": "act-scan", "kind": "activate", "cardId": 34298391},
            {"id": "to-ep", "kind": "to_ep"},
        ],
    )
    hit = follow_book(req, LineCursor(SIT_RABBIT, 3))
    assert hit is None
    result = top5(req)
    assert result.source == "heuristic"
    assert result.ranked[0].actionId == "act-scan"


def test_infer_without_cursor() -> None:
    req = _req(
        self={"hand": [FACELESS], "monsters": [RABBIT], "spells": [WORLD]},
        constraints={"normalSummonUsed": True, "summonCount": 1},
        legalActions=[
            {"id": "act-faceless", "kind": "activate", "cardId": FACELESS},
            {"id": "to-ep", "kind": "to_ep"},
        ],
    )
    hit = follow_book(req)
    assert hit is not None
    assert hit.stepIndex == 3
    assert hit.action.id == "act-faceless"


def test_partial_extra_aborts_line() -> None:
    book = load_book()
    sit = next(s for s in book.situations if s.situationId == SIT_RABBIT)
    req = _req(self={"hand": [RABBIT], "monsters": [], "spells": [], "extra": [66011101]})
    assert extra_missing(sit, 0, req)


def test_infer_threats_from_opp_grave() -> None:
    req = _req(threats=[], opp={"grave": [FUWALOS]})
    assert "fuwalos" in infer_threats(req)


def test_own_ash_is_not_a_threat() -> None:
    req = _req(threats=["ash"], self={"hand": [14558127]}, opp={"hand": [], "grave": []})
    assert "ash" not in infer_threats(req)


def test_decide_auto_plays_book(tmp_path, monkeypatch) -> None:
    from yugioh_agentic.paths import set_test_dirs

    set_test_dirs(memory=tmp_path / "memory", generated=tmp_path / "generated")
    try:
        session = TeachSession()
        req = _req(duelId="auto-1", requestId="auto-1")
        response = session.decide_auto(req)
        assert response.actionId == "ns-rabbit"
        assert response.source == "book"
        log = (tmp_path / "memory" / "duels" / "auto-1.md").read_text(encoding="utf-8")
        assert "ns-rabbit" in log
        assert "book" in log
    finally:
        set_test_dirs(None, None)


def test_teach_override_is_logged(tmp_path) -> None:
    from yugioh_agentic.paths import set_test_dirs

    set_test_dirs(memory=tmp_path / "memory", generated=tmp_path / "generated")
    try:
        session = TeachSession()
        req = _req(duelId="teach-1", requestId="teach-1")
        session.propose(req)
        response = session.choose(UserChoice(requestId="teach-1", actionId="to-ep", note="paso"))
        assert response.source == "teach"
        log = (tmp_path / "memory" / "duels" / "teach-1.md").read_text(encoding="utf-8")
        assert "teach" in log
        assert "divergió" in log
    finally:
        set_test_dirs(None, None)
