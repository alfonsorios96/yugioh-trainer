import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assignReplayToSituation,
  bookCardIds,
  clearSituationReplay,
  createSituation,
  deleteSituation,
  emptyBook,
  emptyEndBoard,
  findSituation,
  situationSlug,
  uniqueSituationId,
  updateSituation,
} from "../dist/index.js";

describe("situation book edits", () => {
  test("slugifies titles without accents", () => {
    assert.equal(situationSlug("Nueva situación"), "nueva-situacion");
    assert.equal(situationSlug("Ash al search"), "ash-al-search");
    assert.equal(situationSlug("   "), "situacion");
  });

  test("creates a situation with a unique id", () => {
    let book = emptyBook();
    book = createSituation(book, { title: "Nueva situación" });
    book = createSituation(book, { title: "Nueva situación" });
    assert.equal(book.situations[0].situationId, "nueva-situacion");
    assert.equal(book.situations[1].situationId, "nueva-situacion-2");
    assert.equal(book.situations[0].title, "Nueva situación");
    assert.deepEqual(book.situations[0].steps, []);
  });

  test("renames title and id without duplicating the entry", () => {
    let book = createSituation(emptyBook(), { title: "Ash" });
    book = updateSituation(book, "ash", {
      title: "Ash al search",
      situationId: "ash-on-search",
      notes: "Recuperar con Terror",
    });
    assert.equal(book.situations.length, 1);
    const sit = findSituation(book, "ash-on-search");
    assert.equal(sit?.title, "Ash al search");
    assert.equal(sit?.notes, "Recuperar con Terror");
    assert.equal(findSituation(book, "ash"), undefined);
  });

  test("rejects a colliding id", () => {
    let book = createSituation(emptyBook(), { title: "Ash" });
    book = createSituation(book, { title: "Maxx C" });
    assert.throws(
      () => updateSituation(book, "ash", { situationId: "maxx-c" }),
      /Ya existe/,
    );
  });

  test("deletes a situation", () => {
    let book = createSituation(emptyBook(), { title: "Ash" });
    book = createSituation(book, { title: "Maxx C" });
    book = deleteSituation(book, "ash");
    assert.deepEqual(
      book.situations.map((s) => s.situationId),
      ["maxx-c"],
    );
  });

  test("uniqueSituationId skips existing ids", () => {
    const book = createSituation(emptyBook(), { title: "Ash" });
    assert.equal(uniqueSituationId(book, "ash"), "ash-2");
  });

  test("renaming an auto id follows the new title", () => {
    let book = createSituation(emptyBook(), { title: "Nueva situación" });
    book = updateSituation(book, "nueva-situacion", {
      title: "Ash al search",
    });
    assert.equal(book.situations[0].situationId, "ash-al-search");
    assert.equal(book.situations[0].title, "Ash al search");
  });

  test("keeps a custom id when the title changes", () => {
    let book = createSituation(emptyBook(), {
      title: "Ash al search",
      situationId: "ash-on-search",
    });
    book = updateSituation(book, "ash-on-search", {
      title: "Negate al search",
    });
    assert.equal(book.situations[0].situationId, "ash-on-search");
    assert.equal(book.situations[0].title, "Negate al search");
  });

  test("bookCardIds collects steps, searches and end board", () => {
    const book = createSituation(emptyBook(), { title: "Ash" });
    const withCards = {
      ...book,
      situations: book.situations.map((s) => ({
        ...s,
        steps: [
          { kind: "activate", cardId: 91500017, selectCard: [7293697] },
        ],
        endBoard: { monsters: [71808988], spells: [7293697], grave: [] },
      })),
    };
    const ids = bookCardIds(withCards).sort((a, b) => a - b);
    assert.deepEqual(ids, [7293697, 71808988, 91500017]);
  });

  test("assignReplayToSituation keeps a single replay and fills the line", () => {
    let book = createSituation(emptyBook(), { title: "Ash" });
    book = assignReplayToSituation(
      book,
      "ash",
      {
        sourceReplay: "first.yrpX",
        steps: [{ kind: "activate", cardId: 91500017 }],
        endBoard: { monsters: [], spells: [7293697], grave: [] },
      },
      { going: "first", threats: ["ash"] },
    );
    book = assignReplayToSituation(
      book,
      "ash",
      {
        sourceReplay: "second.yrpX",
        steps: [{ kind: "set", cardId: 53094821 }],
        endBoard: { monsters: [], spells: [53094821], grave: [] },
      },
      { going: "first" },
    );
    const sit = findSituation(book, "ash");
    assert.equal(sit?.examples.length, 1);
    assert.equal(sit?.examples[0].sourceReplay, "second.yrpX");
    assert.equal(sit?.steps[0].cardId, 53094821);
    assert.equal(sit?.when.going, "first");
  });

  test("clearSituationReplay drops the line", () => {
    let book = createSituation(emptyBook(), { title: "Ash" });
    book = assignReplayToSituation(book, "ash", {
      sourceReplay: "ash.yrpX",
      steps: [{ kind: "activate", cardId: 91500017 }],
      endBoard: { monsters: [], spells: [7293697], grave: [] },
    });
    book = clearSituationReplay(book, "ash");
    const sit = findSituation(book, "ash");
    assert.deepEqual(sit?.examples, []);
    assert.deepEqual(sit?.steps, []);
    assert.deepEqual(sit?.endBoard, emptyEndBoard());
  });
});
