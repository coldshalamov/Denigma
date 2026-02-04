import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseDngFile, parseTextSidecarFile, sha256Hex, textSidecarToDngFile, type DngFile } from "@denigma/core";
import { detectRepoStore, listDngSidecars } from "./store.js";

export type DoctorReport = {
  repoRoot: string;
  totalSidecars: number;
  trackedFiles: number;
  parseErrors: number;
  missingSourceFiles: number;
  staleSourceHash: number;
  segmentsMissing: number;
  segmentsAmbiguous: number;
  ok: boolean;
};

function countSegments(dng: DngFile): { missing: number; ambiguous: number } {
  let missing = 0;
  let ambiguous = 0;
  for (const seg of dng.segments) {
    if (seg.status === "missing") missing++;
    else if (seg.status === "ambiguous") ambiguous++;
  }
  return { missing, ambiguous };
}

export async function doctorRepo(repoRoot: string): Promise<DoctorReport> {
  const absRepoRoot = resolve(repoRoot);
  const store = await detectRepoStore(absRepoRoot);
  let entries: string[] = [];
  if (store === "dng") {
    entries = await listDngSidecars(absRepoRoot);
  } else {
    const denigmaFilesDir = join(absRepoRoot, ".denigma", "files");
    try {
      entries = await fg("**/*.dng.json", { cwd: denigmaFilesDir, dot: false, onlyFiles: true, absolute: true });
    } catch {
      entries = [];
    }
  }

  let trackedFiles = 0;
  let parseErrors = 0;
  let missingSourceFiles = 0;
  let staleSourceHash = 0;
  let segmentsMissing = 0;
  let segmentsAmbiguous = 0;

  for (const filePath of entries) {
    let dng: DngFile;
    try {
      const text = await readFile(filePath, "utf8");
      if (store === "dng") {
        const sidecar = parseTextSidecarFile(text);
        if (!sidecar) throw new Error("Invalid .dng sidecar");
        // We only need metadata/segments to run validations below; sourceHash comparisons read source directly.
        dng = textSidecarToDngFile(sidecar, "");
      } else {
        dng = parseDngFile(JSON.parse(text));
      }
    } catch {
      parseErrors++;
      continue;
    }

    trackedFiles++;

    const { missing, ambiguous } = countSegments(dng);
    segmentsMissing += missing;
    segmentsAmbiguous += ambiguous;

    const sourceAbs = join(absRepoRoot, dng.sourcePath);
    let sourceText: string;
    try {
      sourceText = await readFile(sourceAbs, "utf8");
    } catch {
      missingSourceFiles++;
      continue;
    }

    const currentHash = sha256Hex(sourceText);
    if (currentHash !== dng.sourceSha256) staleSourceHash++;
  }

  const ok =
    parseErrors === 0 && missingSourceFiles === 0 && staleSourceHash === 0 && segmentsMissing === 0 && segmentsAmbiguous === 0;

  return {
    repoRoot: absRepoRoot,
    totalSidecars: entries.length,
    trackedFiles,
    parseErrors,
    missingSourceFiles,
    staleSourceHash,
    segmentsMissing,
    segmentsAmbiguous,
    ok,
  };
}
