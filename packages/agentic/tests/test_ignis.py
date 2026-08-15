from yugioh_agentic.ignis import lookup_card


def test_builtin_lookup() -> None:
    info = lookup_card(45536531, edo_pro_root=None)
    assert info["name"] == "Funny Dark Rabbit"
    assert info["source"] == "builtin"
