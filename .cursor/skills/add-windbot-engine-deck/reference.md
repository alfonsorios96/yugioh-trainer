# Effect catalog and coverage tests

## Catalog JSON

Path: `packages/windbot-engines/tests/effects/<deck-id>.json`

```json
{
  "deckId": "toon-2026",
  "ydkFileName": "AI_Toon2026.ydk",
  "engineFile": "src/Engines/ToonEngine.cs",
  "effects": [
    {
      "cardId": 91500017,
      "name": "Toon Bookmark",
      "kind": "activate",
      "effect": "Add 1 Toon World or a card that lists Toon World from Deck",
      "setup": {
        "botHand": [91500017],
        "botDeck": [7293697]
      },
      "action": { "type": "activate", "cardId": 91500017 },
      "expect": {
        "selectCardContains": [7293697],
        "note": "Bot prefers Toon World the Perfect World"
      }
    }
  ]
}
```

`kind` values:

- `activate` / `ignition` / `quick` / `trigger` — player-activated; required for every such Lua effect
- `proc` / `continuous` / `replace` — document-only; still counts the card as catalogued

Setup keys (all optional arrays of passcodes): `botHand`, `botDeck`, `botMonster`, `botSpell`, `botGrave`, `botExtra`, `oppHand`, `oppMonster`, `oppSpell`, `oppGrave`.

`expect.selectCardContains` is checked against `Brain.SelectCard` / `SelectNextCard` in `engineFile`. Omit it when the handler has no search priority (plain `return true`).

## Coverage parser

Tests parse:

- YDK lines that are integers under `#main`, `#extra`, `!side`
- `public const int Name = 123;` in `src/Engines/*.cs`
- `ex.Bind(ExecutorType.<Type>, <CardId>.<Name>[, ...])` and numeric literals

A YDK ID is covered if it is bound in that deck's engine **or** in `StapleEngine.cs`.

## Puzzles

`tests/effects.test.mjs` writes `tests/puzzles/<deck-id>-<cardId>-<index>.lua` using EDOPro `Debug.AddCard`. Generated Lua is gitignored. Open under EDOPro Puzzle Mode for a live script check; Node tests do not execute ocgcore.
