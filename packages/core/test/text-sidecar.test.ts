import { describe, expect, test } from "vitest";
import { createDngFile, parseDngFile } from "../src/index.js";
import { dngFileToTextSidecarFile, formatTextSidecarFile, parseTextSidecarFile } from "../src/dng/text-sidecar.js";

describe("text sidecar format", () => {
  test("round-trips DngFile to text and back (structure preserved)", () => {
    const sourceText = ["pub fn add(a: i32, b: i32) -> i32 {", "  a + b", "}"].join("\n");
    const dng = createDngFile({
      sourcePath: "src/lib.rs",
      sourceText,
      segments: [
        {
          id: "seg-1",
          range: { startLine: 1, startCol: 0, endLine: 3, endCol: 0 },
          markdown: "Explains add().",
        },
      ],
    });

    const text = formatTextSidecarFile(dngFileToTextSidecarFile(dng));
    const parsed = parseTextSidecarFile(text);
    expect(parsed?.meta.sourcePath).toBe("src/lib.rs");
    expect(parsed?.segments.length).toBe(1);
    expect(parsed?.segments[0]?.id).toBe("seg-1");
    expect(parsed?.segments[0]?.markdown).toContain("Explains add");

    // Ensure it can be converted into a schema-valid DngFile payload.
    const dng2 = parseDngFile({
      schemaVersion: 1,
      sourcePath: parsed!.meta.sourcePath,
      sourceSha256: parsed!.meta.sourceSha256 || dng.sourceSha256,
      createdAt: parsed!.meta.createdAt,
      updatedAt: parsed!.meta.updatedAt,
      segments: parsed!.segments,
    });
    expect(dng2.segments[0]?.anchor).toBeTruthy();
  });
});

