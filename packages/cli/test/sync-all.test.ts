import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseTextSidecarFile } from "@denigma/core";
import { initRepo } from "../src/repo.js";
import { trackFile } from "../src/track.js";
import { syncAll } from "../src/sync-all.js";

describe("sync-all", () => {
  test("re-anchors all tracked files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-sync-all-"));
    await initRepo(dir);

    await mkdir(join(dir, "src"), { recursive: true });
    const sourceRel = "src/a.ts";
    const sourceAbs = join(dir, "src", "a.ts");
    await writeFile(sourceAbs, "export function a() { return 1; }\n", "utf8");
    await trackFile(dir, sourceRel);

    await writeFile(sourceAbs, ["// inserted", "export function a() { return 1; }", ""].join("\n"), "utf8");
    const res = await syncAll(dir);
    expect(res.total).toBe(1);
    expect(res.updated).toBe(1);

    const dngPath = join(dir, ".dng", "src", "a.ts.dng");
    const dngText = await readFile(dngPath, "utf8");
    const dng = parseTextSidecarFile(dngText);
    expect(dng?.segments[0]?.status).toBe("ok");
    expect(dng?.segments[0]?.range.startLine).toBe(2);
  });
});
