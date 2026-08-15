from __future__ import annotations

import json
from pathlib import Path

import pytest

from yugioh_agentic.ranker import top5
from yugioh_agentic.teach import IllegalActionError, TeachSession
from yugioh_agentic.types import UserChoice, request_from_dict

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def load_case(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def request_of(case: dict):
    return request_from_dict(case["request"])

CASES = sorted(p.name for p in FIXTURES.glob("*.json"))


@pytest.mark.parametrize("name", CASES)
def test_gold_is_top5_and_book_is_first(name: str) -> None:
    case = load_case(name)
    req = request_of(case)
    ranked, situation, mode, scores = top5(req)
    gold = case["expect"]["actionId"]
    ids = [a.actionId for a in ranked]
    assert gold in {a.id for a in req.legalActions}
    assert gold in ids
    assert gold in scores
    if case["expect"].get("mustBeFirst", True):
        assert ids[0] == gold
    if "situationId" in case["expect"]:
        assert situation == case["expect"]["situationId"]
    if "mode" in case["expect"]:
        assert mode == case["expect"]["mode"]


@pytest.mark.parametrize("name", CASES)
def test_choice_and_preference_log(name: str, tmp_memory: Path) -> None:
    case = load_case(name)
    req = request_of(case)
    session = TeachSession(write_lessons=True)
    proposal = session.propose(req)
    gold = case["expect"]["actionId"]
    response = session.choose(UserChoice(requestId=req.requestId, actionId=gold, note="gold"))
    assert response.actionId == gold
    assert response.actionId in {a.id for a in req.legalActions}
    assert response.scores
    pref_path = tmp_memory / "memory" / "preferences.jsonl"
    events_path = tmp_memory / "memory" / "events.jsonl"
    assert pref_path.is_file()
    assert events_path.is_file()
    text = pref_path.read_text(encoding="utf-8")
    assert gold in text
    assert proposal.top5


def test_other_choice_is_hard_negative(tmp_memory: Path) -> None:
    case = load_case("01_rabbit_gold.json")
    req = request_of(case)
    session = TeachSession(write_lessons=True)
    proposal = session.propose(req)
    other = next(a.id for a in req.legalActions if a.id not in {x.actionId for x in proposal.top5} or a.kind == "to_ep")
    # pick to_ep which is legal but not #1
    other = next(a.id for a in req.legalActions if a.kind == "to_ep")
    response = session.choose(UserChoice(requestId=req.requestId, actionId=other, note="paso"))
    assert response.actionId == other
    assert response.fromTop5 == (other in {a.actionId for a in proposal.top5})


def test_illegal_choice_rejected(tmp_memory: Path) -> None:
    case = load_case("01_rabbit_gold.json")
    req = request_of(case)
    session = TeachSession(write_lessons=False)
    session.propose(req)
    with pytest.raises(IllegalActionError):
        session.choose(UserChoice(requestId=req.requestId, actionId="not-legal"))
