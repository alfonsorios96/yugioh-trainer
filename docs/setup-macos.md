# macOS setup — YGO Trainer

## 1. Install Project Ignis EDOPro

1. Download the latest macOS build from the [Project Ignis releases / Distribution](https://github.com/ProjectIgnis/Distribution) channels (or the official Ignis site).
2. Place the game folder somewhere stable, e.g. `~/Games/ProjectIgnis` or `~/ProjectIgnis`.
3. Launch EDOPro once so it downloads updates from delta repos (includes [DeltaBagooska](https://github.com/ProjectIgnis/DeltaBagooska) card/script updates for the Bagooska client line).
4. Confirm these exist inside the install folder:
   - `WindBot/` (with `bots.json`)
   - `deck/`
   - `replay/`
   - card databases / expansions (after first update)

Card logic comes from [CardScripts](https://github.com/ProjectIgnis/CardScripts) via the client update repos — you do not need to clone CardScripts manually for the MVP.

## 2. Install this trainer

```bash
cd /path/to/yugioh
npm install
npm run build:packages
npm run tauri:dev
```

Requirements: Node 20+, Rust (rustup), Xcode CLT on macOS.

## 3. Configure the app

1. Open **Settings**.
2. Set **Install folder** to your EDOPro directory (Browse…).
3. Optionally add an OpenAI-compatible **API key** for LLM coaching. Without a key, static matchup lessons still work.
4. Go to **Train** → pick rival + deck → **Sync WindBot bots** → **Start duel**.

## 4. Local duel flow

1. Trainer tries to launch EDOPro and WindBot.
2. In EDOPro, **host a local room** (default port `7911`) and select your deck.
3. WindBot joins with `Deck=<executor>` (Blue-Eyes / SkyStriker / Tearlaments / KewlTune / LightAndDarkness / Toon2026).
4. For **Kewl Tune**, **Light and Darkness**, and **Toon 2026**, install executors once (needs git + Mono `msbuild`/`xbuild`):

```bash
npm run install:engines -- /path/to/your/EDOPro
```

That writes `WindBot/Decks/AI_KewlTune.ydk`, `AI_LightAndDarkness.ydk`, `AI_Toon2026.ydk`, merges those rivals into `WindBot/bots.json`, and rebuilds `WindBot.exe` with the new engines (original exe saved as `WindBot.exe.ygo-trainer-bak`). If your install already has `ExecutorBase.dll`, it compiles `WindBot/Executors/YgoTrainerEngines.dll` instead.
5. After the duel, use **Coach → Analyze latest replay**.

If WindBot does not auto-start on macOS (missing native binary / mono / dotnet), start the AI from EDOPro’s built-in bot UI, or run WindBot manually with:

```text
Host=127.0.0.1 Port=7911 Deck=SkyStriker Name=Sky Striker Chat=false
```

## 5. Content updates

- Rivals: `content/rivals/index.json`
- Lessons: `content/lessons/*.json`
- Academy: `content/academy/fundamentals.json`

Restart or rebuild the app after editing content JSON.
