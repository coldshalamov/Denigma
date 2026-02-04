import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  dngFileToTextSidecarFile,
  formatTextSidecarFile,
  parseDngFile,
  parseTextSidecarFile,
  remapDngFileToText,
  textSidecarToDngFile,
} from "@denigma/core";
import { normalizeRepoRelativePath } from "./paths.js";
import { denigmaSidecarPath, detectRepoStore, dngSidecarPath } from "./store.js";

export async function syncFile(repoRoot: string, sourceRepoRelativePath: string): Promise<void> {
  const normalizedSourcePath = normalizeRepoRelativePath(sourceRepoRelativePath);
  const store = await detectRepoStore(repoRoot);
  const sidecarAbsPath = store === "dng" ? dngSidecarPath(repoRoot, normalizedSourcePath) : denigmaSidecarPath(repoRoot, normalizedSourcePath);

  const sourceAbsPath = join(repoRoot, ...normalizedSourcePath.split("/"));
  const sourceText = await readFile(sourceAbsPath, "utf8");

  if (store === "dng") {
    const text = await readFile(sidecarAbsPath, "utf8");
    const parsed = parseTextSidecarFile(text);
    if (!parsed) throw new Error(`Invalid .dng sidecar: ${sidecarAbsPath}`);
    const dng = textSidecarToDngFile(parsed, sourceText);
    const remapped = remapDngFileToText(dng, sourceText);
    await writeFile(sidecarAbsPath, formatTextSidecarFile(dngFileToTextSidecarFile(remapped)), "utf8");
    return;
  }

  const dngText = await readFile(sidecarAbsPath, "utf8");
  const parsed = parseDngFile(JSON.parse(dngText));
  const remapped = remapDngFileToText(parsed, sourceText);
  await writeFile(sidecarAbsPath, JSON.stringify(remapped, null, 2) + "\n", "utf8");
}

