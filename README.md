# YGO Trainer

Desktop training platform for Yu-Gi-Oh! TCG practice. It wraps a local [Project Ignis EDOPro](https://github.com/edo9300/edopro) install: you duel curated [WindBot](https://github.com/ProjectIgnis/windbot) rivals and get AI coaching (static lessons + optional LLM).

Card scripts and updates come from the Ignis ecosystem ([CardScripts](https://github.com/ProjectIgnis/CardScripts), [DeltaBagooska](https://github.com/ProjectIgnis/DeltaBagooska)) via your normal EDOPro client — this repo does **not** fork the C++ client.

## Features (MVP)

- Launch local training duels against **Blue-Eyes**, **Sky Striker**, **Tearlaments**, **Kewl Tune**, **Light and Darkness Ritual**, and **Toon 2026**
- Sync WindBot `bots.json` entries without wiping other bots
- Install META engine `.ydk` files (Kewl Tune / LADR / Toon 2026) into `WindBot/Decks/`
- Import / select `.ydk` decks from your EDOPro `deck/` folder
- **Coach**: pre-duel briefing, ask-the-coach chat, post-duel replay review
- Works offline with static matchup lessons; add an OpenAI-compatible API key for LLM answers
- Academy checklist for core TCG habits

## Stack

| Piece | Role |
| --- | --- |
| `apps/trainer` | Tauri 2 + React + TypeScript desktop UI |
| `packages/edopro-bridge` | Install probe, bots merge, YDK, launch plans, replay helpers |
| `packages/coach` | Static + LLM coaching |
| `packages/windbot-engines` | AGPL Kewl Tune / LADR / Toon 2026 WindBot executors |
| `content/` | Rivals, lessons, academy, sample deck |

## Quick start (macOS)

```bash
npm install
npm run build:packages
npm run tauri:dev
```

You need **Node 20+**, **Rust**, and a local **EDOPro** install with **WindBot**.

Detailed steps: [docs/setup-macos.md](docs/setup-macos.md)

1. Set the EDOPro folder in **Settings**
2. Optional: paste an API key for LLM coaching (see [`.env.example`](.env.example) for variable names; the app stores the key in its settings store)
3. **Train** → pick rival + deck → **Sync WindBot bots** → **Start duel**
4. For Kewl Tune / Light and Darkness / Toon 2026: `npm run install:engines -- /path/to/EDOPro` so WindBot loads `YgoTrainerEngines.dll`
5. Host a local room in EDOPro if WindBot needs a host to join
6. Use **Coach** before / during / after the duel

## Scripts

```bash
npm run build:packages   # compile bridge + coach + windbot-engines
npm run tauri:dev        # desktop app (dev)
npm run tauri:build      # desktop app (release)
npm run typecheck        # TypeScript check
npm run test -w @yugioh/windbot-engines  # YDK Bind coverage + effect catalog
npm run install:engines -- /path/to/ProjectIgnis  # ydk + bots.json + META WindBot DLLs
npm run bump -- patch    # or minor / major; omit to infer from conventional commits
```

## Versioning

Each local commit is **pushed to origin** by a `post-commit` hook. When those commits land on `main`, GitHub Actions bumps the shared semver (`package.json`, Tauri, Cargo) and pushes a `chore(release): vX.Y.Z` tag.

| Commit prefix | Bump |
| --- | --- |
| `feat:` | minor |
| `BREAKING CHANGE` or `feat!:` / `fix!:` | major |
| anything else (`fix:`, `chore:`, …) | patch |

Skip a bump with `[skip bump]` in the commit message, or a push with `[skip push]` / `SKIP_PUSH=1`. Manual bump: `npm run bump -- patch --commit --tag --push`.

## License & attribution

- Wrapper code: **MIT** ([LICENSE](LICENSE))
- Upstream Ignis / EDOPro / WindBot / CardScripts: **AGPL-3.0** — see [docs/licenses.md](docs/licenses.md)
- Yu-Gi-Oh!™ — not affiliated with Konami or Shueisha
