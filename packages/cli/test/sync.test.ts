import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseTextSidecarFile } from "@denigma/core";
import { initRepo } from "../src/repo.js";
import { trackFile } from "../src/track.js";
import { syncFile } from "../src/sync.js";

describe("syncFile", () => {
  test("remaps ranges when source changed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-sync-"));
    await initRepo(dir);
    await mkdir(join(dir, "src"), { recursive: true });

    const sourceRel = "src/example.ts";
    const sourceAbs = join(dir, sourceRel);
    await writeFile(sourceAbs, ["one", "alpha()", "beta()", "gamma()", "five"].join("\n"), "utf8");

    const dngPath = await trackFile(dir, sourceRel);

    // Insert a line above the first anchored segment start.
    await writeFile(sourceAbs, ["zero", "one", "alpha()", "beta()", "gamma()", "five"].join("\n"), "utf8");

    await syncFile(dir, sourceRel);

    const updatedText = await readFile(dngPath, "utf8");
    const updated = parseTextSidecarFile(updatedText);

    // The first segment should have shifted down by one.
    expect(updated?.segments[0]?.range.startLine).toBeGreaterThan(1);
  });
});
