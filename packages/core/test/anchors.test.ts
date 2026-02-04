import { describe, expect, test } from "vitest";
import { createAnchorForRange, remapRangeByAnchor } from "../src/dng/anchors.js";

describe("anchors", () => {
  test("remaps a range after inserted lines above", () => {
    const original = ["line 1", "alpha()", "beta()", "gamma()", "line 5"].join("\n");

    const anchor = createAnchorForRange(original, {
      startLine: 2,
      startCol: 0,
      endLine: 4,
      endCol: 0,
    });

    const edited = ["line 0 inserted", "line 1", "alpha()", "beta()", "gamma()", "line 5"].join(
      "\n",
    );

    const remapped = remapRangeByAnchor(edited, anchor);
    expect(remapped.ok).toBe(true);
    if (!remapped.ok) return;
    expect(remapped.range.startLine).toBe(3);
    expect(remapped.range.endLine).toBe(5);
  });

  test("reports ambiguous when multiple candidates match", () => {
    const fileText = ["x", "target()", "y", "target()", "z"].join("\n");
    const anchor = {
      before: [],
      start: "target()",
      end: "target()",
      after: [],
    };

    const remapped = remapRangeByAnchor(fileText, anchor);
    expect(remapped.ok).toBe(false);
    if (remapped.ok) return;
    expect(remapped.reason).toBe("ambiguous");
  });
});

