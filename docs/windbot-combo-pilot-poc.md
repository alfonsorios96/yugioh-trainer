# WindBot ComboPilot PoC — postmortem

**Status:** abandoned (2026-08-15).  
**Kept:** combo book in Bot Lab (`book.json`, extract, diagnose, graph, combo line).  
**Removed:** runtime Pilot (`ComboPilot.cs`, `ToonComboBook.cs`, `ComboAllow` gates, emit, `pilot.ts`).

This note is for a future approach. Do not re-attach a step cursor to WindBot `AddExecutor` without solving the failures below.

---

## Goal

Make `[AI] Toon 2026` play the gold line from `packages/windbot-engines/combos/toon-2026/book.json` when the opening hand matches a situation, and otherwise improvise toward that situation’s `endBoard`.

Guarantee: **one active recipe per turn**, not an average of every recipe.

---

## What already existed (committed)

| Piece | Role |
|---|---|
| Bot Lab (`155f002`, `b84ee54`) | Author situations from `.yrpX`, notes, end board, graph |
| `compileComboBook` | Merge every situation’s `selectCard` / `selectNextCard` into `ToonEngine` handlers |
| `ToonEngine.cs` | Fixed `Bind` list + hardcoded `SelectCard` priorities |
| Book | Gold lines: Rabbit no-extenders, Comic Cat no-extenders, Comic Cat alternative |

The book was a **post-game** tool (diagnose / learn). WindBot never read it during the duel.

---

## Why the first engine did not follow the book

`compileComboBook` **prepended IDs from all situations into one handler**. Comic Cat’s `SelectNextCard` became a union. Blue-Eyes Toon Dragon sat first (other lines / fallback ATK), so a Comic Cat opener summoned Blue-Eyes instead of Funny Dark Rabbit.

**Mirror match 001** — bot had Rabbit; line not followed (book unused at runtime).  
**Mirror match 002** — Comic Cat, no Rabbit, no searchers. Recipe: `first-going-comic-cat-no-extenders`. Bot NS Comic Cat, then SS **Blue-Eyes** instead of Rabbit.

Hardcoding `if (ComicCat) pick Rabbit` would only patch that hand. The request was: follow when the formula matches, improvise toward the end board when it only resembles a recipe.

---

## Approach: runtime ComboPilot

Implemented 2026-08-14 (uncommitted; now deleted).

```
book.json
  → infer selects from consecutive gold steps
  → tighten `when` (handContains / handExcludes / priority)
  → emit ToonComboBook.cs
  → ComboPilot.BeginTurn(going, hand, world, threats)
  → ToonEngine: ComboAllow → ApplyPilotSelects → NoteComboPlayed
```

### Modes

| Mode | Score | Behavior |
|---|---|---|
| `follow` | ≥ 6 | Only the current (or immediately next available) book step |
| `improvise` | ≥ 1 | Skip illegal steps; allow later recipe cards or `endBoard` targets |
| `fallback` | < 1 | Old hardcoded `SelectCard` lists |

Scoring (opening only): going ±3/−5, `handContains` ±4, `handExcludes` ±2/−4, `worldOnField` ±2, threats +4 each / −2 if none, plus `priority`.

TypeScript (`pilot.ts`) and C# (`ComboPilot.cs`) were meant to stay twins. Tests lived in `packages/bot-lab/tests/pilot.test.mjs`.

### WindBot wiring

- `MetaExecutor.ComboAllow` / `NoteComboPlayed` / `ComboSelectPlace` — first call on our turn locked the situation (`_pilotStarted`, never reset).
- Every Toon `Bind` returned `false` unless the Pilot allowed that `(kind, cardId)`.
- `OnSelectPlace` / `OnSelectPosition` used book `place` / `stance`.
- `compileComboBook` was gutted (returned `[]`) so lists would not merge again.
- `install:engines` emitted `ToonComboBook.cs` then compiled the plugin DLL.

---

## Live attempts (same evening)

Replays in `ProjectIgnis/replay/`. Hands are the **bot** unless noted.

### 1 — First plugin with Pilot (reviews 001 / 003 / 004, ~22:50)

| Replay | Hand | First play | Book wanted |
|---|---|---|---|
| review 001 | Comic Cat + **Table** | Activate Table | NS Comic Cat |
| review 003 | Rabbit + **Bookmark** + Perfect World | Bookmark → World | NS Rabbit |
| review 004 | Comic Cat + **Bookmark** | Activate Bookmark | NS Comic Cat |

**Cause:** titles say “no extenders” because the gold replay is one-card. `tightenWhen` treated Bookmark / Table / Terraforming as **`handExcludes`**. Having a searcher dropped the score to 3 → **improvise**. Improvise allowed any later recipe card or end-board grave target. Bookmark is in the Rabbit grave; Table is a later step. WindBot registers **Activate before Summon**, so searchers won.

**Patch:** do not exclude searchers from “no extenders”. Follow blocks Bookmark/Table/World until the NS. Tests named after those three hands.

### 2 — Review 001 (new file, ~22:58)

Hand: Comic Cat, Mermaid, Comic Cat, Fuwalos, **Rabbit**. Picked Rabbit line (correct). Played:

1. NS Rabbit  
2. Rabbit → Perfect World  
3. World search → Faceless  
4. Faceless → Mind Scan on field  
5. **End Phase** (Toon Terror set)

Gold after Faceless: **Rabbit again → Mind Scan → World → Table → extra → Terror last**.

**Causes (stacked):**

- Perfect World is two activates (place + search). The cursor treated the second as a **later** World step and skipped the middle.
- Next gold step is **re-activate Rabbit** (soft OPT). The game does not offer it; the Pilot waited.
- Mind Scan was legal and in hand/field; follow would not play it while the cursor sat on Rabbit.

**Patch:** second World activate must not skip Faceless; if Rabbit cannot recycle, continue to Mind Scan.

### 3 — Mind Scan announce (~23:07)

Mind Scan’s quick effect is `Duel.AnnounceCard`. The continuous public-hand effect is already on. The bot should name the interruption that most hurts **this** turn (Nibiru on the fifth summon, Ash, Veiler, Ogre, Imperm on empty field, …). Implemented as `AnnounceMindScanThreat` in `ToonEngine` (reverted with the Pilot).

### 4 — Review 002 (~23:11)

Hand: Mind Scan, Veiler, **Comic Cat**, Comic Cat, Bookmark. Follow Comic Cat. Played:

1. NS Comic Cat — correct  
2. Activate, tribute self — correct  
3. **SS Evil Box** — book wants Rabbit  

Comic Cat is two clicks: tribute (field), then a monster that lists Toon World (hand/deck). Pilot only queued Rabbit on `SelectNextCard`. WindBot spent that queue on the **tribute** (Rabbit not on field → discarded), then SS used the default: legal Toon with most ATK = **Evil Box**. Book notes for this line say not to use Evil Box.

**Patch:** `SelectCard = [Comic Cat]` (tribute), `SelectNextCard = [Rabbit]`.

### 5 — Review 003 (new file, 23:17) — freeze

Hand: **Table, Rabbit, Fuwalos, Imperm, Called by**. Going first.

Turn 1: DP → SP → MP1 → **EP**. No summon, no activate, no set.  
Turn 2: opponent draws; bot chains Fuwalos (engine alive).

**Cause:** follow + searcher veto **worked** (Table not activated). The only legal opener is **NS Rabbit**. That summon never happened. Follow has no plan B, so the bot passed.

TypeScript `shouldPlay(summon, Rabbit)` is true for that hand. The gap is WindBot: `DefaultNs` → `ComboAllow(Summon, Rabbit)` either never ran or returned false. Unit tests do not execute `OnSelectIdleCmd` / `SummonableCards`.

Likely surfaces (not fully proven):

- Executor order tries every Activate first; Rabbit’s Activate-from-hand is illegal (ignition on field) and `ComboAllow(Activate, Rabbit)` is false while the step is `summon`.
- `SummonableCards` vs `IsOriginalCode` if WindBot’s `cards.cdb` lacks 45536531 (card lives in `cards.delta.cdb`).
- `AvailableIds()` / `SkipUnavailable` if hand IDs are empty at `Allow` time — cursor jumps to the first `spsummon` and denies NS Rabbit.
- `OnSelectPlace` returning a bit that cancels the summon (GameAI usually still picks z2; replay had **no** `MSG_SUMMONING`, so the Summon action itself likely never left WindBot).

---

## Why this architecture failed

1. **Merged SelectCard cannot encode per-line intent.** One handler, many recipes → last/first ID wins.

2. **WindBot is a flat executor list, not a state machine.** `OnSelectIdleCmd` walks `AddExecutor` order. Activate is always considered before Summon **for that executor**, and Activate executors are registered first. A summon-first recipe fights the framework.

3. **`when` scoring is brittle.** “No extenders” described the gold replay, not a veto. Searchers in hand flipped follow → improvise and the bot “followed” the wrong card.

4. **One `cardId` is not one decision.** Perfect World (place vs search), Rabbit (NS vs ignition vs recycle), Comic Cat (tribute vs SS) are different prompts. A linear cursor + one `SelectCard` queue cannot represent them.

5. **Soft once-per-turn vs book repeats.** Gold lines recycle Rabbit/Box/Ultimate. The cursor waits for an activate the game will not offer.

6. **Follow is all-or-nothing.** Blocking the wrong play without landing the right one = empty turn. That is worse than the old searcher-first bot.

7. **Tests lie.** `shouldPlay` / `pickSituation` passing does not mean WindBot will NS. Need an idle-command fixture or a logged `ComboAllow` trace.

8. **Install surface.** Plugin DLL vs rebuilt `WindBot.exe`, EDOPro must be fully quit, delta CDB vs WindBot CDB, `OnSelectPlace` 32-bit field vs 8-bit filter.

9. **Pilot lifetime.** `_pilotStarted` is once per duel. Turn 2+ would reuse turn-1 situation/hand.

10. **Improvise toward `endBoard` is too wide.** Grave/extra targets (Bookmark, Table, Evil Box) become legal openers.

---

## What to keep (still in tree)

The book is the useful artifact. Next approach should **read** it, not drive WindBot with a cloned cursor.

| Path | What it is |
|---|---|
| `packages/windbot-engines/combos/toon-2026/book.json` | Situations, gold steps, notes, end boards, example hands |
| `packages/windbot-engines/combos/toon-2026/model.json` | Graph nodes/edges derived from the book |
| `packages/bot-lab` | Parse/edit book, extract line from `.yrpX`, diagnose, learn log |
| `apps/bot-lab` | Libro / grafo / combo line (verb arrows) / zonas / stances |
| `packages/bot-lab/src/zones.ts`, `comboLine.ts` | Place labels (MZ3, Campo…), compact human line |

`ToonEngine` is back to the pre-Pilot `Bind` + static `SelectCard` lists. `compileComboBook` again merges book selects into those lists (same limitation as before — do not treat that as “follows the book”).

---

## Constraints for a next approach

- **Do not** merge all situations into one `SelectCard`.
- **Do not** gate every WindBot executor with a linear step index unless the cursor models: same card twice, multi-select effects, soft OPT, and “this activate is not the book step”.
- If follow can block a searcher, the Normal Summon **must** be a WindBot executor that actually fires (prove it with an idle-cmd test or a duel log).
- Prefer: policy over the **legal action list** EDOPro already sent (`MSG_SELECT_IDLECMD`), not a shadow script of the gold replay.
- Keep gold replays as the spec for end board and order; use them to **score** legal actions, not to require the next `cardId` to exist.
- Searchers in hand are extenders, not a different opener, unless the book says so explicitly.
- Comic Cat: tribute select ≠ summon select. Never put the SS target in the tribute queue.

### Gold openers (Toon 2026, first)

- **Rabbit in hand** → NS Rabbit, then World / Faceless / Mind Scan. Ignore Bookmark/Table/World in hand until that NS.
- **Comic Cat, no Rabbit** → NS Comic Cat, tribute **itself**, SS **Rabbit** (not Blue-Eyes, not Evil Box).
- Bookmark / Table / Terraforming alone → search into one of the above; they are not the one-card gold line.

---

## Related chats

- [Mirror match 001 Rabbit](4369d7f3-767a-4167-b3b4-1d75546ce23a) — book unused at runtime  
- [Comic Cat Blue-Eyes / Pilot plan](c8c33993-5f25-4ebc-8188-c25159841dde) — attempts 1–4  
- [Review 003 pass](89037942-68c5-4989-9310-e33d615af104) — attempt 5  
- Book Lab UI (CRUD, graph, combo line): [681500a9](681500a9-a7e2-4b47-8e9e-580edced1483)
