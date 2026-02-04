import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDngFile } from "@denigma/core";
import { initRepo } from "../src/repo.js";
import { trackFile } from "../src/track.js";

describe("trackFile", () => {
  test("creates a .dng file in .denigma/files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-track-"));
    await initRepo(dir);

    const sourceRel = "src/example.ts";
    const sourceAbs = join(dir, sourceRel);
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(sourceAbs, ["export function a() {", "  return 1;", "}", ""].join("\n"), "utf8");

    const createdPath = await trackFile(dir, sourceRel);
    const dngText = await readFile(createdPath, "utf8");
    const dng = parseDngFile(JSON.parse(dngText));

    expect(dng.sourcePath).toBe(sourceRel);
    expect(dng.segments.length).toBeGreaterThan(0);
  });

  test("rejects path traversal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-track-"));
    await initRepo(dir);

    await expect(trackFile(dir, "../secrets.txt")).rejects.toThrow(/path/i);
  });
});
