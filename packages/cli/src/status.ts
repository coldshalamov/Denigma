import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseDngFile, type DngFile } from "@denigma/core";

export type SegmentStatusCounts = { ok: number; missing: number; ambiguous: number };

export type TrackedFileStatus = {
  sourcePath: string;
  updatedAt: string;
  segmentStatus: SegmentStatusCounts;
};

export type RepoStatus = {
  repoRoot: string;
  files: TrackedFileStatus[];
};

function computeSegmentStatusCounts(dng: DngFile): SegmentStatusCounts {
  let ok = 0;
  let missing = 0;
  let ambiguous = 0;
  for (const seg of dng.segments) {
    if (seg.status === "missing") missing++;
    else if (seg.status === "ambiguous") ambiguous++;
    else ok++;
  }
  return { ok, missing, ambiguous };
}

export async function getRepoStatus(repoRoot: string): Promise<RepoStatus> {
  const absRepoRoot = resolve(repoRoot);
  const denigmaFilesDir = join(absRepoRoot, ".denigma", "files");
  let entries: string[] = [];
  try {
    entries = await fg("**/*.dng.json", { cwd: denigmaFilesDir, dot: false, onlyFiles: true, absolute: true });
  } catch {
    entries = [];
  }

  const files: TrackedFileStatus[] = [];
  for (const filePath of entries) {
    try {
      const text = await readFile(filePath, "utf8");
      const parsed = parseDngFile(JSON.parse(text));
      files.push({
        sourcePath: parsed.sourcePath,
        updatedAt: parsed.updatedAt,
        segmentStatus: computeSegmentStatusCounts(parsed),
      });
    } catch {
      // Skip unreadable/invalid entries.
    }
  }

  files.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return { repoRoot: absRepoRoot, files };
}

