from yugioh_agentic.interpret import interpret_local
from yugioh_agentic.teach import TeachSession
from yugioh_agentic.types import LegalAction, request_from_dict


def _legal() -> list[LegalAction]:
    return [
        LegalAction(id="ns-cat", kind="summon", cardId=72921536, label="Comic Cat"),
        LegalAction(id="act-table", kind="activate", cardId=89997728),
        LegalAction(id="to-ep", kind="to_ep"),
    ]


def test_invocar_normal_comic_cat() -> None:
    result = interpret_local('Invocar normal "Comic Cat"', _legal())
    assert result.matched
    assert result.actionId == "ns-cat"
    assert result.kind == "summon"


def test_activar_table() -> None:
    result = interpret_local("activar Toon Table of Contents", _legal())
    assert result.matched
    assert result.actionId == "act-table"


def test_pasar_turno() -> None:
    result = interpret_local("pasar turno", _legal())
    assert result.matched
    assert result.actionId == "to-ep"


def test_unmatched_when_not_legal() -> None:
    result = interpret_local("Invocar normal Comic Cat", [LegalAction(id="to-ep", kind="to_ep")])
    assert result.matched is False
    assert result.actionId is None
    assert result.cardId == 72921536


def test_teach_interpret_executes(tmp_path) -> None:
    from yugioh_agentic.paths import set_test_dirs

    set_test_dirs(memory=tmp_path / "memory", generated=tmp_path / "generated")
    try:
        req = request_from_dict(
            {
                "requestId": "int-1",
                "duelId": "d",
                "turn": 1,
                "phase": "MP1",
                "going": "first",
                "self": {"hand": [72921536], "monsters": [], "spells": []},
                "opp": {},
                "legalActions": [
                    {"id": "ns-cat", "kind": "summon", "cardId": 72921536},
                    {"id": "to-ep", "kind": "to_ep"},
                ],
            }
        )
        session = TeachSession(write_lessons=False)
        session.propose(req)
        result, response = session.interpret(
            "int-1", 'Invocar normal "Comic Cat"', execute=True
        )
        assert result.matched
        assert response is not None
        assert response.actionId == "ns-cat"
    finally:
        set_test_dirs(None, None)
