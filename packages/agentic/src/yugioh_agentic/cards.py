"""Passcodes and names shared with packages/bot-lab/src/cards.ts."""

from __future__ import annotations

FUNNY_DARK_RABBIT = 45536531
COMIC_CAT = 72921536
EVIL_BOX = 8915275
FACELESS_MAGE = 34314989
TOON_MERMAID = 65458948
BLUE_EYES_TOON = 53183600
PERFECT_WORLD = 7293697
TOON_TABLE = 89997728
TOON_BOOKMARK = 91500017
TOON_TERROR = 53094821
MIND_SCAN = 34298391
TOON_WORLD = 15259703
TERRAFORMING = 73628505
ULTIMATE_DRAGON = 71808988
PERFECTRON = 13203964
FIREWALL = 5043010
CHARMER_QUARTET = 27519978
ZENNA = 7594154
DESAVEWURM = 92422871
BAGOOSKA = 90590303
DUGARES = 66011101
ANIMA = 94259633
CROSS_SHEEP = 50277355
PROTECTCODE = 58036229
ZEALANTIS = 45112597
ACCESSCODE = 86066372

ASH = 14558127
MAXX_C = 23434538
IMPERM = 10045474
NIBIRU = 27204311
VEILER = 97268402
GHOST_OGRE = 59438930
FUWALOS = 42141493
DOMINUS = 40366667

SEARCHERS = frozenset({TOON_BOOKMARK, TOON_TABLE, TERRAFORMING})
WORLD_CARDS = frozenset({PERFECT_WORLD, TOON_WORLD})
SAFE_FUWALOS = frozenset({COMIC_CAT, EVIL_BOX, MIND_SCAN, TOON_TERROR, PERFECT_WORLD})
COMIC_CAT_BAD_SS = frozenset({BLUE_EYES_TOON, EVIL_BOX})

CARD_NAMES: dict[int, str] = {
    FUNNY_DARK_RABBIT: "Funny Dark Rabbit",
    COMIC_CAT: "Comic Cat",
    EVIL_BOX: "Evil Box",
    FACELESS_MAGE: "Faceless Mage",
    TOON_MERMAID: "Toon Mermaid",
    BLUE_EYES_TOON: "Blue-Eyes Toon Dragon",
    PERFECT_WORLD: "Perfect World",
    TOON_TABLE: "Toon Table of Contents",
    TOON_BOOKMARK: "Toon Bookmark",
    TOON_TERROR: "Toon Terror",
    MIND_SCAN: "Mind Scan",
    TOON_WORLD: "Toon World",
    TERRAFORMING: "Terraforming",
    ULTIMATE_DRAGON: "Blue-Eyes Toon Ultimate Dragon",
    PERFECTRON: "Perfectron Hydradrive Dragon",
    FIREWALL: "Firewall Dragon",
    CHARMER_QUARTET: "Charmer Quartet in Bloom",
    ZENNA: "Zenna's Deceiving Doll Maidens",
    DESAVEWURM: "Cyberse Desavewurm",
    BAGOOSKA: "Number 41: Bagooska the Terribly Tired Tapir",
    DUGARES: "Number 60: Dugares the Timeless",
    ANIMA: "Relinquished Anima",
    CROSS_SHEEP: "Cross-Sheep",
    PROTECTCODE: "Protectcode Talker",
    ZEALANTIS: "Worldsea Dragon Zealantis",
    ACCESSCODE: "Accesscode Talker",
    ASH: "Ash Blossom & Joyous Spring",
    MAXX_C: 'Maxx "C"',
    IMPERM: "Infinite Impermanence",
    NIBIRU: "Nibiru, the Primal Being",
    VEILER: "Effect Veiler",
    GHOST_OGRE: "Ghost Ogre & Snow Rabbit",
    FUWALOS: "Mulcharmy Fuwalos",
    DOMINUS: "Dominus Impulse",
}


def card_name(card_id: int | None) -> str:
    if card_id is None or card_id <= 0:
        return "—"
    return CARD_NAMES.get(card_id, f"#{card_id}")


def is_searcher(card_id: int | None) -> bool:
    return card_id in SEARCHERS
