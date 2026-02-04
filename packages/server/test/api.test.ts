import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import request from "supertest";
import { createDngFile } from "@denigma/core";
import { createDenigmaServer } from "../src/server.js";

describe("server api", () => {
  test("lists tracked files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-server-"));
    await mkdir(join(dir, ".denigma", "files"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });

    await writeFile(join(dir, "src", "a.ts"), "export const a = 1;\n", "utf8");
    await writeFile(
      join(dir, ".denigma", "files", "src__a.ts.dng.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          sourcePath: "src/a.ts",
          sourceSha256: "abc",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          segments: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    const app = createDenigmaServer({ repoRoot: dir });
    const res = await request(app).get("/api/files");
    expect(res.status).toBe(200);
    expect(res.body.files.length).toBe(1);
    expect(res.body.files[0].sourcePath).toBe("src/a.ts");
  });

  test("sync endpoint re-anchors a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-server-"));
    await mkdir(join(dir, ".denigma", "files"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });

    const sourcePath = join(dir, "src", "a.ts");
    const originalText = ["function x() {", "  target()", "}"].join("\n") + "\n";
    await writeFile(sourcePath, originalText, "utf8");

    const dng = createDngFile({
      sourcePath: "src/a.ts",
      sourceText: originalText,
      segments: [
        {
          id: "seg-1",
          range: { startLine: 2, startCol: 0, endLine: 2, endCol: 0 },
          markdown: "Explains target",
        },
      ],
    });

    const dngPath = join(dir, ".denigma", "files", "src__a.ts.dng.json");
    await writeFile(dngPath, JSON.stringify(dng, null, 2), "utf8");

    const editedText = ["function x() {", "    target()", "}"].join("\n") + "\n";
    await writeFile(sourcePath, editedText, "utf8");

    const app = createDenigmaServer({ repoRoot: dir });
    const res = await request(app).post("/api/sync").query({ path: "src/a.ts" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.dng.segments[0].status).toBe("ok");
    expect(res.body.dng.segments[0].range.startLine).toBe(2);

    const saved = JSON.parse(await readFile(dngPath, "utf8"));
    expect(saved.segments[0].status).toBe("ok");
    expect(saved.sourceSha256).toBe(res.body.dng.sourceSha256);
  });

  test("rejects saving a dng with mismatched sourcePath", async () => {
    const dir = await mkdtemp(join(tmpdir(), "denigma-server-"));
    await mkdir(join(dir, ".denigma", "files"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });

    const sourceText = "export const a = 1;\n";
    await writeFile(join(dir, "src", "a.ts"), sourceText, "utf8");

    const dng = createDngFile({
      sourcePath: "src/a.ts",
      sourceText,
      segments: [
        {
          id: "seg-1",
          range: { startLine: 1, startCol: 0, endLine: 1, endCol: 0 },
          markdown: "Explains a",
        },
      ],
    });

    const app = createDenigmaServer({ repoRoot: dir });
    const res = await request(app)
      .put("/api/file")
      .query({ path: "src/a.ts" })
      .send({ dng: { ...dng, sourcePath: "src/other.ts" } });

    expect(res.status).toBe(400);
  });
});
