import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { initRepo } from "../src/repo.js";

describe("initRepo", () => {
  test("creates .denigma/denigma.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-init-"));

    await initRepo(dir);

    const configPath = join(dir, ".denigma", "denigma.json");
    const fileStat = await stat(configPath);
    expect(fileStat.isFile()).toBe(true);

    const configText = await readFile(configPath, "utf8");
    const parsed = JSON.parse(configText) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(1);
  });
});

