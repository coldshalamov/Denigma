import { describe, expect, test } from "vitest";
import { createDngFile, parseDngFile } from "../src/index.js";
import { dngFileToTextSidecarFile, formatTextSidecarFile, parseTextSidecarFile } from "../src/dng/text-sidecar.js";

function b64urlUtf8(text: string): string {
  return Buffer.from(text, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

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

  test("parses legacy inline-meta segment headers (@@ ... S:... A:...)", () => {
    const anchor = {
      before: ["pub fn add(a: i32, b: i32) -> i32 {"],
      start: "  a + b",
      end: "  a + b",
      after: ["}"],
    };
    const payload = b64urlUtf8(JSON.stringify(anchor));

    const content = [
      "@@@ denigma 1 sourcePath=src/lib.rs createdAt=2026-01-01T00:00:00.000Z updatedAt=2026-01-01T00:00:00.000Z sourceSha256=deadbeef",
      "",
      `@@ seg-1 L1-L3 S:ok A:${payload}`,
      "Explains add().",
      "",
    ].join("\n");

    const parsed = parseTextSidecarFile(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.segments).toHaveLength(1);
    expect(parsed!.segments[0]!.id).toBe("seg-1");
    expect(parsed!.segments[0]!.status).toBe("ok");
    expect(parsed!.segments[0]!.anchor).toEqual(anchor);
  });

  test("parses segments even when meta line is missing (treated as unsynced)", () => {
    const content = [
      "@@@ denigma 1 sourcePath=src/lib.rs createdAt=2026-01-01T00:00:00.000Z updatedAt=2026-01-01T00:00:00.000Z sourceSha256=deadbeef",
      "",
      "@@ seg-1 L1-L3",
      "Explains add().",
      "",
    ].join("\n");

    const parsed = parseTextSidecarFile(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.segments).toHaveLength(1);
    expect(parsed!.segments[0]!.id).toBe("seg-1");
    expect(parsed!.segments[0]!.status).toBe("missing");
    expect(parsed!.segments[0]!.anchor).toBeUndefined();
  });
});
