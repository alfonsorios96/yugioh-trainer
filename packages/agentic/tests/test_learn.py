from __future__ import annotations

from pathlib import Path

from yugioh_agentic.learn import export_finetune
from yugioh_agentic.paths import set_test_dirs
from yugioh_agentic.teach import TeachSession
from yugioh_agentic.types import UserChoice, request_from_dict


def test_export_finetune(tmp_path: Path) -> None:
    set_test_dirs(memory=tmp_path / "memory", generated=tmp_path / "generated")
    try:
        req = request_from_dict(
            {
                "requestId": "ex-1",
                "duelId": "d",
                "turn": 1,
                "phase": "MP1",
                "going": "first",
                "self": {"hand": [45536531], "monsters": [], "spells": []},
                "opp": {},
                "legalActions": [
                    {"id": "ns-rabbit", "kind": "summon", "cardId": 45536531},
                    {"id": "to-ep", "kind": "to_ep"},
                ],
            }
        )
        session = TeachSession(write_lessons=True)
        proposal = session.propose(req)
        assert proposal.context is not None
        assert proposal.context.self.hand == [45536531]
        session.choose(UserChoice(requestId="ex-1", actionId="ns-rabbit"))
        dest = export_finetune("toon-2026", tmp_path / "memory" / "finetune.jsonl")
        text = dest.read_text(encoding="utf-8")
        assert "ns-rabbit" in text
        assert "chosen" in text
    finally:
        set_test_dirs(None, None)
