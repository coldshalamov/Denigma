import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { initRepo } from "../src/repo.js";
import { trackAll } from "../src/track-all.js";

describe("trackAll", () => {
  test("creates mirrored .dng sidecars in .dng/ directory", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "denigma-track-all-"));
    await mkdir(join(repoRoot, "src"), { recursive: true });
    await writeFile(join(repoRoot, "src", "a.rs"), "pub fn a() -> i32 { 1 }\n", "utf8");
    await writeFile(join(repoRoot, "README.md"), "# Demo\n", "utf8");

    await initRepo(repoRoot); // defaults to .dng store

    const result = await trackAll(repoRoot, { patterns: ["src/**/*.rs", "README.md"] });
    expect(result.total).toBe(2);
    expect(result.tracked).toBe(2);
    expect(result.errors).toBe(0);

    const sidecarPath = join(repoRoot, ".dng", "src", "a.rs.dng");
    const s = await stat(sidecarPath);
    expect(s.isFile()).toBe(true);

    const text = await readFile(sidecarPath, "utf8");
    expect(text).toContain("@@@ denigma 1");
    expect(text).toContain("sourcePath=src/a.rs");
  });
});

