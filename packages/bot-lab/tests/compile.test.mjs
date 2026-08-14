import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyEnginePatches,
  compileComboBook,
  parseComboBook,
  parseHandlers,
  runLearnCycle,
  undoLastApplied,
  validateNoRegression,
} from "../dist/index.js";

const WORLD = 7293697;
const BOOKMARK = 91500017;
const RABBIT = 45536531;
const TABLE = 89997728;

const FIXTURE = `
public static class ToonCardId
{
    public const int PerfectWorld = 7293697;
    public const int ToonBookmark = 91500017;
    public const int FunnyDarkRabbit = 45536531;
    public const int ToonTableOfContents = 89997728;
}

public static class ToonEngine
{
    public static void Register(MetaExecutor ex)
    {
        ex.Bind(ExecutorType.Activate, ToonCardId.ToonBookmark, BookmarkEffect(ex));
        ex.Bind(ExecutorType.Activate, ToonCardId.ToonTableOfContents, TableEffect(ex));
    }

    static Func<bool> BookmarkEffect(MetaExecutor ex)
    {
        return delegate
        {
            ex.Brain.SelectCard(ToonCardId.FunnyDarkRabbit, ToonCardId.PerfectWorld);
            return true;
        };
    }

    static Func<bool> TableEffect(MetaExecutor ex)
    {
        return delegate
        {
            ex.Brain.SelectCard(ToonCardId.ToonBookmark);
            return true;
        };
    }
}
`;

const book = parseComboBook({
  deckId: "toon-2026",
  engineFile: "src/Engines/ToonEngine.cs",
  situations: [
    {
      situationId: "going-first-full",
      title: "full",
      notes: "",
      when: { going: "first" },
      examples: [],
      steps: [
        { kind: "activate", cardId: BOOKMARK, selectCard: [WORLD, RABBIT] },
      ],
      endBoard: { monsters: [], spells: [WORLD], grave: [] },
    },
    {
      situationId: "going-first-table-only",
      title: "table",
      notes: "",
      when: { going: "first" },
      examples: [],
      steps: [
        { kind: "activate", cardId: TABLE, selectCard: [WORLD] },
      ],
      endBoard: { monsters: [], spells: [WORLD], grave: [] },
    },
  ],
});

describe("compile + apply", () => {
  test("parses Bind handlers and SelectCard ids", () => {
    const handlers = parseHandlers(FIXTURE);
    const bookmark = handlers.find((h) => h.name === "BookmarkEffect");
    assert.ok(bookmark);
    assert.deepEqual(bookmark.cardIds, [BOOKMARK]);
    assert.deepEqual(bookmark.calls[0].ids, [RABBIT, WORLD]);
  });

  test("compile prepends gold SelectCard without dropping existing ids", () => {
    const patches = compileComboBook(book, FIXTURE);
    const next = applyEnginePatches(FIXTURE, patches);
    const handlers = parseHandlers(next);
    const bookmark = handlers.find((h) => h.name === "BookmarkEffect");
    const table = handlers.find((h) => h.name === "TableEffect");
    assert.equal(bookmark.calls[0].ids[0], WORLD);
    assert.ok(bookmark.calls[0].ids.includes(RABBIT));
    assert.ok(table.calls[0].ids.includes(WORLD));
    assert.ok(table.calls[0].ids.includes(BOOKMARK));
    const check = validateNoRegression(book, next);
    assert.equal(check.ok, true);
  });

  test("learn cycle auto-applies SelectCard patch and undo restores", () => {
    const diagnosis = {
      verdict: "wrong-search",
      situationId: "going-first-full",
      score: 4,
      notes: "desvio",
    };
    const result = runLearnCycle({
      book,
      diagnosis,
      engineSource: FIXTURE,
      replayName: "bot.yrpX",
    });
    assert.equal(result.applied, true);
    assert.ok(result.nextSource);
    const bookmark = parseHandlers(result.nextSource).find(
      (h) => h.name === "BookmarkEffect",
    );
    assert.equal(bookmark.calls[0].ids[0], WORLD);

    const undone = undoLastApplied(result.nextSource, [result.entry]);
    assert.ok(undone);
    const restored = parseHandlers(undone.source).find(
      (h) => h.name === "BookmarkEffect",
    );
    assert.deepEqual(restored.calls[0].ids, [RABBIT, WORLD]);
  });

  test("ok diagnosis does not patch", () => {
    const result = runLearnCycle({
      book,
      diagnosis: {
        verdict: "ok",
        situationId: "going-first-full",
        score: 10,
        notes: "ok",
      },
      engineSource: FIXTURE,
      replayName: "ok.yrpX",
    });
    assert.equal(result.applied, false);
    assert.equal(result.patches.length, 0);
  });
});
