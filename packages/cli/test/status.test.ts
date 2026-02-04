import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { initRepo } from "../src/repo.js";
import { trackFile } from "../src/track.js";
import { getRepoStatus } from "../src/status.js";

describe("status", () => {
  test("reports tracked file and segment counts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-status-"));
    await initRepo(dir);

    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src", "a.ts"), "export function a() { return 1; }\n", "utf8");
    await trackFile(dir, "src/a.ts");

    const status = await getRepoStatus(dir);
    expect(status.files.length).toBe(1);
    expect(status.files[0]?.sourcePath).toBe("src/a.ts");
    expect(status.files[0]?.segmentStatus.ok).toBeGreaterThan(0);
  });
});

