# Licenses and attribution

## This project (YGO Trainer wrapper)

The original code in this repository (trainer app, `@yugioh/coach`, `@yugioh/edopro-bridge`, training content authored here) is licensed under the **MIT License**. See [`LICENSE`](../LICENSE).

[`packages/windbot-engines`](../packages/windbot-engines) contains **WindBot executor source** (C# classes inheriting `DefaultExecutor`). That package is **AGPL-3.0-or-later** because it is a derivative of [ProjectIgnis/windbot](https://github.com/ProjectIgnis/windbot). The trainer copies `.ydk` files and optional compiled DLLs into a local EDOPro install; it does not vendor `WindBot.exe`.

## Project Ignis / EDOPro ecosystem (AGPL-3.0)

The following upstream projects are **not** vendored as source in this MVP, but the trainer **orchestrates** them on the user’s machine. They are free software under the **GNU Affero General Public License v3** (or later), unless a file states otherwise:

- [edo9300/edopro](https://github.com/edo9300/edopro) — EDOPro client  
- [edo9300/ygopro-core](https://github.com/edo9300/ygopro-core) — ocgcore  
- [ProjectIgnis/CardScripts](https://github.com/ProjectIgnis/CardScripts) — Lua card scripts  
- [ProjectIgnis/BabelCDB](https://github.com/ProjectIgnis/BabelCDB) — card databases  
- [ProjectIgnis/DeltaBagooska](https://github.com/ProjectIgnis/DeltaBagooska) — client update delta  
- [ProjectIgnis/windbot](https://github.com/ProjectIgnis/windbot) — WindBot Ignite AI  

If you distribute a product that **modifies or embeds** AGPL-covered components, you must comply with AGPL (including corresponding source for network use where applicable). This wrapper currently shells out to a local EDOPro/WindBot install and does not ship those binaries. Distributing `packages/windbot-engines` (or a compiled `YgoTrainerEngines.dll`) requires AGPL corresponding source.

## Trademark disclaimer

Yu-Gi-Oh! is a trademark of Shueisha / Konami. This project is a fan training tool and is **not affiliated with, endorsed by, or sponsored by** Shueisha, Konami, or Project Ignis.
