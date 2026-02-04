import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDngFile } from "@denigma/core";
import { encodeRepoRelativePathToDngName, normalizeRepoRelativePath } from "./paths.js";
import { scanSegments } from "./scan.js";

export async function trackFile(repoRoot: string, sourceRepoRelativePath: string): Promise<string> {
  const normalizedSourcePath = normalizeRepoRelativePath(sourceRepoRelativePath);
  const denigmaFilesDir = join(repoRoot, ".denigma", "files");
  const dngName = encodeRepoRelativePathToDngName(normalizedSourcePath);
  const dngPath = join(denigmaFilesDir, dngName);

  const sourcePath = join(repoRoot, normalizedSourcePath);
  const sourceText = await readFile(sourcePath, "utf8");

  const dng = createDngFile({
    sourcePath: normalizedSourcePath,
    sourceText,
    segments: scanSegments(sourceText),
  });

  await writeFile(dngPath, JSON.stringify(dng, null, 2) + "\n", "utf8");
  return dngPath;
}
