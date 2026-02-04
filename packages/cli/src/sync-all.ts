import fg from "fast-glob";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  dngFileToTextSidecarFile,
  formatTextSidecarFile,
  parseDngFile,
  parseTextSidecarFile,
  remapDngFileToText,
  textSidecarToDngFile,
  type DngFile,
} from "@denigma/core";
import { detectRepoStore, listDngSidecars } from "./store.js";

export type SyncAllResult = {
  total: number;
  updated: number;
  missingSource: number;
  parseErrors: number;
};

export async function syncAll(repoRoot: string): Promise<SyncAllResult> {
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

  let updated = 0;
  let missingSource = 0;
  let parseErrors = 0;

  for (const dngAbsPath of entries) {
    let dng: DngFile;
    try {
      const dngText = await readFile(dngAbsPath, "utf8");
      if (store === "dng") {
        const sidecar = parseTextSidecarFile(dngText);
        if (!sidecar) throw new Error("Invalid .dng sidecar");
        dng = textSidecarToDngFile(sidecar, "");
      } else {
        dng = parseDngFile(JSON.parse(dngText));
      }
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
    if (store === "dng") {
      await writeFile(dngAbsPath, formatTextSidecarFile(dngFileToTextSidecarFile(remapped)), "utf8");
    } else {
      await writeFile(dngAbsPath, JSON.stringify(remapped, null, 2) + "\n", "utf8");
    }
    updated++;
  }

  return { total: entries.length, updated, missingSource, parseErrors };
}
