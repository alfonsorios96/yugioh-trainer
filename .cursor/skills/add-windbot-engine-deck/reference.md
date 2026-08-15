# Agent deck artefacts

The live custom deck is Toon 2026 Agent. WindBot only serializes legal actions
and executes the chosen `actionId`. Do not add `Register` / `Bind` / `SelectCard`
engines or an effect catalog that assumes hardcoded handlers.

## YDK

`packages/windbot-engines/ydk/AI_<Deck>.ydk` must match the `[Deck]` attribute
on the proxy executor.

## Card IDs

`src/Engines/<Deck>Engine.cs` holds `public const int` passcodes the executor
or agent may name (for example Comic Cat tribute handling). It is not a
decision engine.

## Combo book

If the deck has teach-mode situations, put them in
`packages/windbot-engines/combos/<deck-id>/book.json`. The agent compiles that
book to markdown; Bot Lab edits the JSON. The executor does not read it.
