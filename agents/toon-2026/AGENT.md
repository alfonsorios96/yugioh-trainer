# Toon 2026 — agente

Mazo first-going de combo Toon. El engine evalúa si una línea del `book.json` sigue viva; si sí, el siguiente paso es determinístico. Si no (interrupción o recurso faltante), puntúa con la heurística.

## Cómo decide

1. Infiere threats (Fuwalos / Maxx C / Ash en mano, GY o cadena del rival).
2. Si la amenaza aborta el libro (`fuwalos` T1 first, o `maxx-c`): heurística `safe-pass`.
3. Si `when` del libro encaja y el siguiente paso está en `legalActions` (o un select/tribute “glue”): **`source: book`**, modo `follow`.
4. Si el siguiente paso ya no es legal: suelta la línea y usa la heurística (`improvise` / `safe-pass` / cadena / announce).

`/v1/decide` aplica solo la decisión del engine. `YGO_TEACH=1` o `"teach": true` vuelve al wait del humano en Bot Lab.

Bitácora por partida: `agents/toon-2026/resources/memory/duels/{duelId}.md` — cada click con contexto, legales, top-5 y si fue `book`, `heuristic` o `teach`.

## Prioridades del libro

1. Funny Dark Rabbit en mano, sin abort: línea `first-going-funny-dark-rabbit-no-extenders` (NS Rabbit primero; Bookmark / Table / Terraforming / World no se tocan antes).
2. Comic Cat en mano y no Rabbit: `first-going-comic-cat-no-extenders` (priority 0). Tribute Cat a sí mismo, SS Rabbit. La alternativa Bagooska (priority −1) no se elige si la principal vive.
3. En la línea oro, Comic Cat tributes a **Blue-Eyes Toon Dragon**. En la opener de Cat, el SS es **Rabbit** (nunca Blue-Eyes ni Evil Box).
4. Solo searcher: heurística hacia Rabbit o Cat.
5. Fuwalos T1: seguro Cat + Evil Box + Mind Scan + Toon Terror + Perfect World, luego pasar.
6. Campo casi listo: set Toon Terror y pasar.
7. Mind Scan announce: nombrar la interrupción que más duele este turno (Nibiru al quinto summon, Ash, Veiler, Imperm).
8. Handtraps de monstruo (Ash, Ghost Ogre, Veiler, Maxx C, Fuwalos, Nibiru, Dominus): **se quedan en mano**. No se invocan ni se setean. En cadena propia se pasa; nunca Ash/Ogre a nuestro Bookmark, World o Cat. Contra el rival sí: Ash al search, Terror, Ogre. `chainPlayer == -1` es ventana abierta (Draw/Standby), no cadena propia: no se pasa por defecto.
9. Dimension Shifter y Called by solo resuelven en cadena. Un `activate` idle de esas cartas no hace nada y se come el Main Phase. En ventana abierta, Shifter se tira si la mano no tiene starter (Rabbit / Cat / searcher / World); si hay línea de combo, no se lockea el cementerio.
10. Infinite Impermanence es **trampa**: setearla tiene prioridad (salvo Toon Terror al cierre, o activarla going second desde la mano). No se encadena a nuestros efectos.
11. Funny Dark Rabbit al colocar Perfect World: **Campo**, no la mano (opción con `desc` de carta, no HINTMSG 573/506).

## Modos

- `follow` — camino determinístico del libro (`source: book`).
- `improvise` — heurística: Ash al search, going second, o nada encaja (`source: heuristic`).
- `safe-pass` — cortar el combo (Fuwalos, Maxx C).
- `teach` — el humano eligió otra acción distinta a la del engine.
