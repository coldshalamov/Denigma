import { describe, expect, test } from "vitest";
import { createDngFile, remapDngFileToText } from "../src/dng/remap.js";

describe("remap", () => {
  test("remaps segment ranges and updates status", () => {
    const sourcePath = "src/example.ts";
    const original = ["one", "alpha()", "beta()", "gamma()", "five"].join("\n");

    const dng = createDngFile({
      sourcePath,
      sourceText: original,
      segments: [
        {
          id: "seg-1",
          range: { startLine: 2, startCol: 0, endLine: 4, endCol: 0 },
          markdown: "Explains alpha..gamma",
        },
      ],
    });

    const edited = ["zero", "one", "alpha()", "beta()", "gamma()", "five"].join("\n");
    const remapped = remapDngFileToText(dng, edited);

    expect(remapped.segments[0]?.status).toBe("ok");
    expect(remapped.segments[0]?.range.startLine).toBe(3);
    expect(remapped.segments[0]?.range.endLine).toBe(5);
  });

  test("remaps when indentation changes", () => {
    const sourcePath = "src/example.ts";
    const original = ["function x() {", "  target()", "}"].join("\n");

    const dng = createDngFile({
      sourcePath,
      sourceText: original,
      segments: [
        {
          id: "seg-1",
          range: { startLine: 2, startCol: 0, endLine: 2, endCol: 0 },
          markdown: "Explains target",
        },
      ],
    });

    const edited = ["function x() {", "    target()", "}"].join("\n");
    const remapped = remapDngFileToText(dng, edited);

    expect(remapped.segments[0]?.status).toBe("ok");
    expect(remapped.segments[0]?.range.startLine).toBe(2);
    expect(remapped.segments[0]?.range.endLine).toBe(2);
  });

  test("remaps when surrounding comment context is removed", () => {
    const sourcePath = "src/example.ts";
    const original = ["// leading comment", "function x() {", "  target()", "}"].join("\n");

    const dng = createDngFile({
      sourcePath,
      sourceText: original,
      segments: [
        {
          id: "seg-1",
          range: { startLine: 2, startCol: 0, endLine: 4, endCol: 0 },
          markdown: "Explains x",
        },
      ],
    });

    const edited = ["function x() {", "  target()", "}"].join("\n");
    const remapped = remapDngFileToText(dng, edited);

    expect(remapped.segments[0]?.status).toBe("ok");
    expect(remapped.segments[0]?.range.startLine).toBe(1);
    expect(remapped.segments[0]?.range.endLine).toBe(3);
  });

  test("marks ambiguous segments", () => {
    const sourcePath = "src/example.ts";
    const original = ["x", "target()", "y"].join("\n");

    const dng = createDngFile({
      sourcePath,
      sourceText: original,
      anchorConfig: { contextLines: 0 },
      segments: [
        {
          id: "seg-1",
          range: { startLine: 2, startCol: 0, endLine: 2, endCol: 0 },
          markdown: "Explains target",
        },
      ],
    });

    const edited = ["x", "target()", "y", "target()"].join("\n");
    const remapped = remapDngFileToText(dng, edited);

    expect(remapped.segments[0]?.status).toBe("ambiguous");
  });
});
