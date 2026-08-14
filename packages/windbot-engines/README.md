# WindBot META engines (AGPL-3.0)

Reusable WindBot executors for current TCG training: **Kewl Tune** and **Light and Darkness Ritual** (Pure).

These classes inherit `DefaultExecutor` from [ProjectIgnis/windbot](https://github.com/ProjectIgnis/windbot) and are licensed **AGPL-3.0-or-later**. The YGO Trainer wrapper remains MIT; it only copies artefacts into a local EDOPro install.

## Deploy

The Ignis `DecksManager` can load extra executors from `WindBot/Executors/*.dll` **only if** `ExecutorBase.dll` is present. Typical EDOPro builds merge those types into `WindBot.exe` and do **not** export `DefaultExecutor`, so a plugin DLL cannot compile against the exe.

This script therefore:

1. Copies `ydk/*.ydk` into `WindBot/Decks/` and merges Kewl Tune / Light and Darkness into `bots.json`
2. Tries a plugin DLL if `ExecutorBase.dll` is next to `WindBot.exe`
3. Otherwise clones [ProjectIgnis/windbot](https://github.com/ProjectIgnis/windbot), injects our C# into `Game/AI/Decks/`, builds, and replaces `WindBot.exe` (original saved as `WindBot.exe.ygo-trainer-bak`)

From the repo root:

```bash
npm run install:engines -- /path/to/ProjectIgnis
```

Needs **git** and **msbuild** or **xbuild** (Mono) for the rebuild path. The trainer **Sync WindBot bots** button also writes the same `.ydk` files.

`Deck=` keys:

| Rival | `Deck=` | `.ydk` |
| --- | --- | --- |
| Kewl Tune | `KewlTune` | `AI_KewlTune.ydk` |
| Light and Darkness | `LightAndDarkness` | `AI_LightAndDarkness.ydk` |

Compile needs git + Mono `msbuild`/`xbuild` (rebuilds WindBot.exe with Kewl Tune / LADR) or a local `ExecutorBase.dll` for the plugin path.

## v1 lines

- **Kewl Tune:** Mix/Reco search → Rotary extra Normal Summon → Synchro Track Maker → Remix / RS. Going second: Lightning Storm + battle.
- **LADR Pure:** Pre-Prep / Manju / Celtic Mystic → Griffoh as full ritual tribute → Magician of Dark Chaos or BLS → Mind Shuffle follow-up. Azamina/Branded are not in this build.
