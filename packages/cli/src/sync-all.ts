import fg from "fast-glob";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseDngFile, remapDngFileToText, type DngFile } from "@denigma/core";

export type SyncAllResult = {
  total: number;
  updated: number;
  missingSource: number;
  parseErrors: number;
};

export async function syncAll(repoRoot: string): Promise<SyncAllResult> {
  const absRepoRoot = resolve(repoRoot);
  const denigmaFilesDir = join(absRepoRoot, ".denigma", "files");

  let entries: string[] = [];
  try {
    entries = await fg("**/*.dng.json", { cwd: denigmaFilesDir, dot: false, onlyFiles: true, absolute: true });
  } catch {
    entries = [];
  }

  let updated = 0;
  let missingSource = 0;
  let parseErrors = 0;

  for (const dngAbsPath of entries) {
    let dng: DngFile;
    try {
      const dngText = await readFile(dngAbsPath, "utf8");
      dng = parseDngFile(JSON.parse(dngText));
    } catch {
      parseErrors++;
      continue;
    }

    const sourceAbsPath = join(absRepoRoot, dng.sourcePath);
    let sourceText: string;
    try {
      sourceText = await readFile(sourceAbsPath, "utf8");
    } catch {
      missingSource++;
      continue;
    }

    const remapped = remapDngFileToText(dng, sourceText);
    await writeFile(dngAbsPath, JSON.stringify(remapped, null, 2) + "\n", "utf8");
    updated++;
  }

  return { total: entries.length, updated, missingSource, parseErrors };
}

