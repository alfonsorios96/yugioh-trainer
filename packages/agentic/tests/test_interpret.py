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


def test_tributar_comic_cat() -> None:
    legal = [
        LegalAction(id="select-72921536-0", kind="select", cardId=72921536),
        LegalAction(id="select-45536531-1", kind="select", cardId=45536531),
    ]
    result = interpret_local("tributar Comic Cat", legal)
    assert result.matched
    assert result.actionId == "select-72921536-0"


def test_pasar_cadena() -> None:
    legal = [
        LegalAction(id="chain-53094821-0", kind="chain", cardId=53094821),
        LegalAction(id="chain-pass", kind="chain"),
    ]
    result = interpret_local("pasar cadena", legal)
    assert result.matched
    assert result.actionId == "chain-pass"


def test_efecto_2_perfect_world() -> None:
    legal = [
        LegalAction(id="activate-7293697-116699152", kind="activate", cardId=7293697, desc=116699152),
        LegalAction(id="activate-7293697-116699153", kind="activate", cardId=7293697, desc=116699153),
    ]
    result = interpret_local("activar Perfect World efecto 2", legal)
    assert result.matched
    assert result.actionId == "activate-7293697-116699153"


def test_nombrar_nibiru() -> None:
    legal = [
        LegalAction(id="announce-14558127-0", kind="announce", cardId=14558127),
        LegalAction(id="announce-27204311-1", kind="announce", cardId=27204311),
    ]
    result = interpret_local("nombrar Nibiru", legal)
    assert result.matched
    assert result.actionId == "announce-27204311-1"


def test_pasar_turno() -> None:
    result = interpret_local("pasar turno", _legal())
    assert result.matched
    assert result.actionId == "to-ep"


def test_unmatched_when_not_legal() -> None:
    result = interpret_local("Invocar normal Comic Cat", [LegalAction(id="to-ep", kind="to_ep")])
    assert result.matched is False
    assert result.actionId is None
    assert result.cardId == 72921536


def test_understood_and_action_ids() -> None:
    result = interpret_local('Invocar normal "Comic Cat"', _legal())
    assert result.understood
    assert result.actionIds == ["ns-cat"]
    assert result.actions[0]["id"] == "ns-cat"
    assert result.ambiguous is False


def test_tributar_dos_cartas() -> None:
    legal = [
        LegalAction(id="select-72921536-0", kind="select", cardId=72921536, label="Elegir Comic Cat"),
        LegalAction(id="select-45536531-1", kind="select", cardId=45536531, label="Elegir Funny Dark Rabbit"),
    ]
    result = interpret_local("tributar Comic Cat y Funny Dark Rabbit", legal)
    assert result.matched
    assert set(result.actionIds) == {"select-72921536-0", "select-45536531-1"}
    assert result.ambiguous is False
    assert "Comic Cat" in result.understood
    assert "Funny Dark Rabbit" in result.understood


def test_activar_perfect_world_ambiguous() -> None:
    legal = [
        LegalAction(id="activate-7293697-116699152", kind="activate", cardId=7293697, desc=116699152),
        LegalAction(id="activate-7293697-116699153", kind="activate", cardId=7293697, desc=116699153),
    ]
    result = interpret_local("activar Perfect World", legal)
    assert result.matched
    assert result.ambiguous
    assert set(result.actionIds) == {
        "activate-7293697-116699152",
        "activate-7293697-116699153",
    }


def test_teach_interpret_preview_does_not_consume(tmp_path) -> None:
    from yugioh_agentic.paths import set_test_dirs

    set_test_dirs(memory=tmp_path / "memory", generated=tmp_path / "generated")
    try:
        req = request_from_dict(
            {
                "requestId": "int-preview",
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
            "int-preview", 'Invocar normal "Comic Cat"', execute=False
        )
        assert result.matched
        assert result.actionIds == ["ns-cat"]
        assert response is None
        assert session.pending() is not None
    finally:
        set_test_dirs(None, None)


def test_teach_interpret_ambiguous_does_not_execute(tmp_path) -> None:
    from yugioh_agentic.paths import set_test_dirs

    set_test_dirs(memory=tmp_path / "memory", generated=tmp_path / "generated")
    try:
        req = request_from_dict(
            {
                "requestId": "int-amb",
                "duelId": "d",
                "turn": 1,
                "phase": "MP1",
                "going": "first",
                "self": {"hand": [], "monsters": [], "spells": [7293697]},
                "opp": {},
                "legalActions": [
                    {"id": "activate-7293697-116699152", "kind": "activate", "cardId": 7293697, "desc": 116699152},
                    {"id": "activate-7293697-116699153", "kind": "activate", "cardId": 7293697, "desc": 116699153},
                ],
            }
        )
        session = TeachSession(write_lessons=False)
        session.propose(req)
        result, response = session.interpret(
            "int-amb", "activar Perfect World", execute=True
        )
        assert result.ambiguous
        assert response is None
        assert session.pending() is not None
    finally:
        set_test_dirs(None, None)


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
