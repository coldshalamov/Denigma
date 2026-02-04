import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseTextSidecarFile } from "@denigma/core";
import { initRepo } from "../src/repo.js";
import { trackFile } from "../src/track.js";
import { importComments } from "../src/comments.js";

describe("comments", () => {
  test("imports comment-only lines into segment markdown", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-comments-"));
    await initRepo(dir);

    await mkdir(join(dir, "src"), { recursive: true });
    const sourceRel = "src/a.ts";
    const sourceAbs = join(dir, "src", "a.ts");
    await writeFile(sourceAbs, ["// hello", "export function a() {", "  return 1;", "}", ""].join("\n"), "utf8");
    await trackFile(dir, sourceRel);

    await importComments(dir, sourceRel, { strip: false });

    const dngPath = join(dir, ".dng", "src", "a.ts.dng");
    const dngText = await readFile(dngPath, "utf8");
    const dng = parseTextSidecarFile(dngText);
    expect(dng?.segments[0]?.markdown).toContain("// hello");
  });

  test("strips comment-only lines from source and keeps anchors usable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-strip-"));
    await initRepo(dir);

    await mkdir(join(dir, "src"), { recursive: true });
    const sourceRel = "src/a.ts";
    const sourceAbs = join(dir, "src", "a.ts");
    await writeFile(
      sourceAbs,
      ["// top", "/**", " * doc", " */", "export function a() {", "  return 1;", "}", ""].join("\n"),
      "utf8",
    );
    await trackFile(dir, sourceRel);

    await importComments(dir, sourceRel, { strip: true });

    const newSource = await readFile(sourceAbs, "utf8");
    expect(newSource).not.toContain("// top");
    expect(newSource).not.toContain("doc");
    expect(newSource).toContain("export function a()");

    const dngPath = join(dir, ".dng", "src", "a.ts.dng");
    const dngText = await readFile(dngPath, "utf8");
    const dng = parseTextSidecarFile(dngText);
    expect(dng?.segments[0]?.status).toBe("ok");
    expect(dng?.segments[0]?.markdown).toContain("// top");
  });
});
