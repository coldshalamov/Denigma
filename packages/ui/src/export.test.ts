import { describe, expect, test } from "vitest";
import { createDngFile } from "@denigma/core";
import { exportFilenameForSourcePath, generateMarkdownExport, sidecarFilenameForSourcePath } from "./export";

describe("generateMarkdownExport", () => {
  test("includes segment header, markdown, and code excerpt", () => {
    const sourcePath = "src/a.ts";
    const sourceText = ["export function a() {", "  return 1;", "}", ""].join("\n");
    const dng = createDngFile({
      sourcePath,
      sourceText,
      segments: [
        {
          id: "seg-1",
          range: { startLine: 1, startCol: 0, endLine: 3, endCol: 0 },
          markdown: "Explains function `a`.",
        },
      ],
    });

    const md = generateMarkdownExport({ sourcePath, sourceText, dng });
    expect(md).toContain("# Denigma export: src/a.ts");
    expect(md).toContain("## seg-1 (L1–L3)");
    expect(md).toContain("Explains function `a`.");
    expect(md).toContain("```ts");
    expect(md).toContain("export function a()");
  });

  test("generates stable export filenames for markdown and sidecars", () => {
    expect(exportFilenameForSourcePath("src/a.ts")).toBe("src__a.ts.denigma.md");
    expect(sidecarFilenameForSourcePath("src/a.ts", "dng")).toBe("src__a.ts.dng");
    expect(sidecarFilenameForSourcePath("src/a.ts", "denigma")).toBe("src__a.ts.dng.json");
  });
});
