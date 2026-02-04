import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDngFile, remapDngFileToText } from "@denigma/core";
import { encodeRepoRelativePathToDngName, normalizeRepoRelativePath } from "./paths.js";

export async function syncFile(repoRoot: string, sourceRepoRelativePath: string): Promise<void> {
  const denigmaFilesDir = join(repoRoot, ".denigma", "files");
  const normalizedSourcePath = normalizeRepoRelativePath(sourceRepoRelativePath);
  const dngName = encodeRepoRelativePathToDngName(normalizedSourcePath);
  const dngPath = join(denigmaFilesDir, dngName);

  const sourcePath = join(repoRoot, normalizedSourcePath);
  const sourceText = await readFile(sourcePath, "utf8");

  const dngText = await readFile(dngPath, "utf8");
  const parsed = parseDngFile(JSON.parse(dngText));

  const remapped = remapDngFileToText(parsed, sourceText);
  await writeFile(dngPath, JSON.stringify(remapped, null, 2) + "\n", "utf8");
}
