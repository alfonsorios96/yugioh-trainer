---
name: add-windbot-engine-deck
description: >-
  Adds a WindBot teach-mode agent deck to packages/windbot-engines: copy YDK,
  add CardId constants, register a proxy Executor that asks the agentic server,
  and wire the trainer rival. Use when adding a new WindBot deck, executor,
  YDK, rival, or when the user mentions windbot-engines, AI_*.ydk, or a new
  training bot.
---

# Add a WindBot agent deck

The live custom deck is **Toon 2026 Agent**. Do not revive hardcoded
`Register` / `SelectCard` engines or ComboPilot. Decisions belong to
`packages/agentic`.

Follow this checklist in order. Copy this and track progress:

```
Task Progress:
- [ ] Parse YDK and resolve card names from EDOPro scripts
- [ ] Copy ydk/AI_<Deck>.ydk
- [ ] CardId constants in src/Engines/<Deck>Engine.cs
- [ ] Proxy Executor : MetaExecutor (serialize legales, POST /v1/decide)
- [ ] Sync manifest.json and src/index.ts
- [ ] Trainer rival + lesson + content.ts + docs
- [ ] bots.snippet.json + META_PLUGIN_DECKS
- [ ] npm test -w @yugioh/windbot-engines
```

## 1. Parse the YDK

Read the source `.ydk` (`#main` / `#extra` / `!side`). Collect unique passcodes.

Resolve names from a local EDOPro install, in this order:

1. `repositories/delta-bagooska/script/official/c{id}.lua`
2. `script/official/c{id}.lua`

English name is the second `--` comment line.

## 2. Copy the YDK

Write `packages/windbot-engines/ydk/AI_<Deck>.ydk` with header `#created by yugioh-trainer META engines`. Keep the same card counts as the source list.

WindBot keys:

- `name`: display name (may have spaces)
- `deck`: PascalCase identifier, no spaces (`Toon2026Agent`)
- file: `AI_<deck>.ydk` matching `[Deck("Toon2026Agent", "AI_Toon2026")]`

## 3. Card IDs + proxy Executor

Pattern: [`ToonAgentExecutor.cs`](../../../packages/windbot-engines/src/Decks/ToonAgentExecutor.cs) + [`ToonEngine.cs`](../../../packages/windbot-engines/src/Engines/ToonEngine.cs).

- `src/Engines/<Deck>Engine.cs`: `*CardId` constants only. No `Register`, no `Bind`, no `SelectCard`.
- `src/Decks/<Deck>Executor.cs`: `[Deck("<Deck>", "AI_<YdkStem>")]`, extends `MetaExecutor`, binds generic Activate/Summon/SpSummon/Set/Repos/End, POSTs legales to the teach server, executes the chosen `actionId`.

Do not patch C# from Bot Lab. Learning writes markdown / preferences in `agents/`.

## 4. Manifest sync

Update **both**:

- [`packages/windbot-engines/manifest.json`](../../../packages/windbot-engines/manifest.json) — `sourceFiles` and `decks`
- [`packages/windbot-engines/src/index.ts`](../../../packages/windbot-engines/src/index.ts) — `META_ENGINE_SOURCE_FILES` and `META_ENGINE_DECKS`

They must list the same files and deck keys. `install.mjs` reads the manifest.

Also add the `Deck=` key to [`packages/edopro-bridge/src/windbotInventory.ts`](../../../packages/edopro-bridge/src/windbotInventory.ts) `META_PLUGIN_DECKS` and [`content/windbot/bots.snippet.json`](../../../content/windbot/bots.snippet.json).

## 5. Trainer rival

1. Append to [`content/rivals/index.json`](../../../content/rivals/index.json)
2. Add [`content/lessons/vs-<id>.json`](../../../content/lessons/) using the Toon 2026 lesson schema (`title`, `summary`, `winConditions`, `keyCardsRespect`, `keyCardsNegate`, `tips`, `handtrapGuidance`, `commonMistakes`)
3. Import YDK + lesson in [`apps/trainer/src/lib/content.ts`](../../../apps/trainer/src/lib/content.ts) (`lessons` map and `META_ENGINE_YDK_FILES`)
4. Mention the rival in root README, `packages/windbot-engines/README.md`, and `docs/setup-macos.md`

## 6. Tests

Add or extend `packages/windbot-engines/tests/`:

1. YDK file exists
2. CardId constants exist for the cards the agent names
3. Combo book tests if the deck has `combos/<id>/book.json`

Run:

```bash
npm test -w @yugioh/windbot-engines
npm run typecheck
```

Do not rewrite EDOPro Lua scripts. Do not run `install:engines` unless the user asks.

## Examples

User: "Agrega el mazo Toon desde /path/Toon.ydk"

Agent: parse YDK → `AI_Toon2026.ydk` → `ToonCardId` / `ToonAgentExecutor` → manifest + index → rival `toon-2026` → `npm test -w @yugioh/windbot-engines`.
