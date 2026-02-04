import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createDngFile } from "@denigma/core";
import { doctorRepo } from "../src/doctor.js";

describe("doctorRepo", () => {
  test("reports healthy repo as ok", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "denigma-doctor-ok-"));
    await mkdir(join(repoRoot, ".denigma", "files"), { recursive: true });

    const sourcePath = "src/a.ts";
    await mkdir(join(repoRoot, "src"), { recursive: true });
    const sourceText = ["export function a() {", "  return 1", "}"].join("\n");
    await writeFile(join(repoRoot, sourcePath), sourceText, "utf8");

    const dng = createDngFile({
      sourcePath,
      sourceText,
      segments: [{ id: "seg-1", range: { startLine: 1, startCol: 0, endLine: 3, endCol: 0 }, markdown: "Explains a" }],
    });

    const sidecarPath = join(repoRoot, ".denigma", "files", "a.dng.json");
    await writeFile(sidecarPath, JSON.stringify(dng, null, 2), "utf8");

    const report = await doctorRepo(repoRoot);
    expect(report.ok).toBe(true);
    expect(report.trackedFiles).toBe(1);
    expect(report.parseErrors).toBe(0);
    expect(report.missingSourceFiles).toBe(0);
    expect(report.staleSourceHash).toBe(0);
    expect(report.segmentsMissing).toBe(0);
    expect(report.segmentsAmbiguous).toBe(0);
  });

  test("reports stale source hash when source changed", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "denigma-doctor-stale-"));
    await mkdir(join(repoRoot, ".denigma", "files"), { recursive: true });

    const sourcePath = "src/a.ts";
    await mkdir(join(repoRoot, "src"), { recursive: true });
    const sourceText = ["export function a() {", "  return 1", "}"].join("\n");
    await writeFile(join(repoRoot, sourcePath), sourceText, "utf8");

    const dng = createDngFile({
      sourcePath,
      sourceText,
      segments: [{ id: "seg-1", range: { startLine: 1, startCol: 0, endLine: 3, endCol: 0 }, markdown: "Explains a" }],
    });

    const sidecarPath = join(repoRoot, ".denigma", "files", "a.dng.json");
    await writeFile(sidecarPath, JSON.stringify(dng, null, 2), "utf8");

    const changed = sourceText + "\n// changed";
    await writeFile(join(repoRoot, sourcePath), changed, "utf8");

    const report = await doctorRepo(repoRoot);
    expect(report.ok).toBe(false);
    expect(report.staleSourceHash).toBe(1);
  });

  test("reports missing source files", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "denigma-doctor-missing-"));
    await mkdir(join(repoRoot, ".denigma", "files"), { recursive: true });

    const sourcePath = "src/missing.ts";
    const dngJson = {
      schemaVersion: 1,
      sourcePath,
      sourceSha256: "deadbeef",
      createdAt: "2026-02-04T00:00:00.000Z",
      updatedAt: "2026-02-04T00:00:00.000Z",
      segments: [],
    };

    const sidecarPath = join(repoRoot, ".denigma", "files", "missing.dng.json");
    await writeFile(sidecarPath, JSON.stringify(dngJson, null, 2), "utf8");

    const report = await doctorRepo(repoRoot);
    expect(report.ok).toBe(false);
    expect(report.missingSourceFiles).toBe(1);

    // Sanity: ensure we didn't create the source file.
    await expect(readFile(join(repoRoot, sourcePath), "utf8")).rejects.toThrow();
  });
});

