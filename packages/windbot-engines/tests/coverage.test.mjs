import assert from "node:assert/strict";
import { basename } from "node:path";
import { describe, test } from "node:test";
import {
  allBoundIds,
  listYdkFiles,
  uniqueYdkIds,
} from "./lib/parse.mjs";

describe("executor Bind coverage", () => {
  const { bound } = allBoundIds();

  test("at least one YDK is present", () => {
    assert.ok(listYdkFiles().length >= 3);
  });

  for (const ydkPath of listYdkFiles()) {
    test(`${basename(ydkPath)} every card id has a Bind`, () => {
      const missing = [...uniqueYdkIds(ydkPath)].filter((id) => !bound.has(id));
      assert.deepEqual(
        missing,
        [],
        `Unbound passcodes in ${basename(ydkPath)}: ${missing.join(", ")}`,
      );
    });
  }
});
