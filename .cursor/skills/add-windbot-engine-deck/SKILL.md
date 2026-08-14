---
name: add-windbot-engine-deck
description: >-
  Adds a WindBot META engine deck to packages/windbot-engines: copy YDK, bind
  every card in an Engine/Executor, register the trainer rival, and run
  controlled effect tests. Use when adding a new WindBot deck, executor, YDK,
  rival, or when the user mentions windbot-engines, AI_*.ydk, or a new training
  bot.
---

# Add a WindBot engine deck

Follow this checklist in order. Copy this and track progress:

```
Task Progress:
- [ ] Parse YDK and resolve card names from EDOPro scripts
- [ ] Copy ydk/AI_<Deck>.ydk
- [ ] Inventory every activatable effect
- [ ] Engine CardId + Bind (reuse StapleEngine)
- [ ] Executor : MetaExecutor
- [ ] Sync manifest.json and src/index.ts
- [ ] Trainer rival + lesson + content.ts + docs
- [ ] Effect catalog + coverage tests
- [ ] npm test -w @yugioh/windbot-engines
```

## 1. Parse the YDK

Read the source `.ydk` (`#main` / `#extra` / `!side`). Collect unique passcodes.

Resolve names from a local EDOPro install, in this order:

1. `repositories/delta-bagooska/script/official/c{id}.lua`
2. `script/official/c{id}.lua`

English name is the second `--` comment line. List every **activatable** effect (Ignition, Quick, Trigger, Spell/Trap Activate) from those comments. Continuous / `SPSUMMON_PROC` do not get `Activate` binds, but do get `Summon` or `SpSummon` if the bot must play the card.

## 2. Copy the YDK

Write `packages/windbot-engines/ydk/AI_<Deck>.ydk` with header `#created by yugioh-trainer META engines`. Keep the same card counts as the source list.

WindBot keys:

- `name`: display name (may have spaces)
- `deck`: PascalCase identifier, no spaces (`Toon2026`)
- file: `AI_<deck>.ydk` matching `[Deck("Toon2026", "AI_Toon2026")]`

## 3. Engine + Executor

Pattern: [`KewlTuneExecutor.cs`](../../../packages/windbot-engines/src/Decks/KewlTuneExecutor.cs) + [`KewlTuneEngine.cs`](../../../packages/windbot-engines/src/Engines/KewlTuneEngine.cs).

- `src/Engines/<Deck>Engine.cs`: `*CardId` constants and `Register(MetaExecutor ex)`
- `src/Decks/<Deck>Executor.cs`: `[Deck("<Deck>", "AI_<Deck>")]`, constructor order:

```
StapleEngine.RegisterHandtraps(this);
StapleEngine.RegisterBreakers(this);
<Deck>Engine.Register(this);
StapleEngine.RegisterExtra(this);
```

Reuse IDs already in [`StapleEngine.cs`](../../../packages/windbot-engines/src/Engines/StapleEngine.cs). Do not re-bind them in the new engine.

Every unique YDK passcode must have at least one `Bind(ExecutorType.*, id)`. Typical binds:

| Card | Bind |
| --- | --- |
| Main-deck monster the bot Normal Summons | `Summon` + `Activate` if it has an ignition/quick |
| Proc / contact / extra monster | `SpSummon` + `Activate` if optional effects exist |
| Spell/Trap | `Activate`; settable traps also in `SpellSet` |

Handlers: `SelectCard` / `SelectNextCard` only when the Lua asks the player to pick. Otherwise `return true` (WindBot .NET 4.0 style: `delegate { return true; }`, no expression-bodied members).

`OnSelectOption` / `OnAnnounceCard` overrides live on the **Executor** class, not the static Engine.

## 4. Manifest sync

Update **both**:

- [`packages/windbot-engines/manifest.json`](../../../packages/windbot-engines/manifest.json) — `sourceFiles` and `decks`
- [`packages/windbot-engines/src/index.ts`](../../../packages/windbot-engines/src/index.ts) — `META_ENGINE_SOURCE_FILES` and `META_ENGINE_DECKS`

They must list the same files and deck keys. `install.mjs` reads the manifest.

## 5. Trainer rival

1. Append to [`content/rivals/index.json`](../../../content/rivals/index.json)
2. Add [`content/lessons/vs-<id>.json`](../../../content/lessons/) using the Kewl Tune lesson schema (`title`, `summary`, `winConditions`, `keyCardsRespect`, `keyCardsNegate`, `tips`, `handtrapGuidance`, `commonMistakes`)
3. Import YDK + lesson in [`apps/trainer/src/lib/content.ts`](../../../apps/trainer/src/lib/content.ts) (`lessons` map and `META_ENGINE_YDK_FILES`)
4. Mention the rival in root README, `packages/windbot-engines/README.md`, and `docs/setup-macos.md`

## 6. Tests

See [reference.md](reference.md) for catalog JSON and parser rules.

Add or extend `packages/windbot-engines/tests/`:

1. Coverage: every ID in every `ydk/AI_*.ydk` appears in some `Bind` in `src/Engines/*.cs`
2. Catalog: `tests/effects/<deck-id>.json` — one entry per activatable effect of each unique YDK card
3. Completeness: YDK unique IDs ⊆ catalog `cardId`s
4. Priorities: each `expect.selectCardContains` ID appears in a `Brain.SelectCard` / `SelectNextCard` call in that engine
5. Generate EDOPro Debug puzzles into `tests/puzzles/` (not a CI gate)

Run:

```bash
npm test -w @yugioh/windbot-engines
npm run typecheck
```

Do not rewrite EDOPro Lua scripts. Do not run `install:engines` unless the user asks.

## Examples

User: "Agrega el mazo Toon desde /path/Toon.ydk"

Agent: parse YDK → `AI_Toon2026.ydk` → `ToonEngine`/`ToonExecutor` → manifest + index → rival `toon-2026` → `tests/effects/toon-2026.json` → `npm test -w @yugioh/windbot-engines`.
