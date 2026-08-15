# WindBot META engines (AGPL-3.0)

Reusable WindBot executor for current TCG training: **Toon 2026 Agent**.

These classes inherit `DefaultExecutor` from [ProjectIgnis/windbot](https://github.com/ProjectIgnis/windbot) and are licensed **AGPL-3.0-or-later**. The YGO Trainer wrapper remains MIT; it only copies artefacts into a local EDOPro install.

## Deploy

The Ignis `DecksManager` can load extra executors from `WindBot/Executors/*.dll` **only if** `ExecutorBase.dll` is present. Typical EDOPro builds merge those types into `WindBot.exe` and do **not** export `DefaultExecutor`, so a plugin DLL cannot compile against the exe.

This script therefore:

1. Copies `ydk/*.ydk` into `WindBot/Decks/` and merges Toon 2026 Agent into `bots.json`
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
| Toon 2026 Agent | `Toon2026Agent` | `AI_Toon2026.ydk` (teach proxy; no local decisions) |

Compile needs git + Mono `msbuild`/`xbuild` (rebuilds WindBot.exe with the META engines) or a local `ExecutorBase.dll` for the plugin path.

## v1 lines

- **Toon 2026 Agent:** Bookmark / Table / Terraforming → Perfect World searches → Funny Dark Rabbit extra NS → Comic Cat tribute into Blue-Eyes Toon → contact Ultimate Dragon. Mind Scan + Toon Terror. Decisions come from the teach-mode agent, not a hardcoded executor.
