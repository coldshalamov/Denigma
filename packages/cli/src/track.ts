import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDngFile, dngFileToTextSidecarFile, formatTextSidecarFile } from "@denigma/core";
import { normalizeRepoRelativePath } from "./paths.js";
import { scanSegments } from "./scan.js";
import { denigmaSidecarPath, detectRepoStore, dngSidecarPath } from "./store.js";

export async function trackFile(repoRoot: string, sourceRepoRelativePath: string): Promise<string> {
  const normalizedSourcePath = normalizeRepoRelativePath(sourceRepoRelativePath);
  const store = await detectRepoStore(repoRoot);
  const sidecarPath = store === "dng" ? dngSidecarPath(repoRoot, normalizedSourcePath) : denigmaSidecarPath(repoRoot, normalizedSourcePath);

  const sourceAbsPath = join(repoRoot, ...normalizedSourcePath.split("/"));
  const sourceText = await readFile(sourceAbsPath, "utf8");

  const dng = createDngFile({
    sourcePath: normalizedSourcePath,
    sourceText,
    segments: scanSegments(sourceText, normalizedSourcePath),
  });

  if (store === "dng") {
    await mkdir(dirname(sidecarPath), { recursive: true });
    const text = formatTextSidecarFile(dngFileToTextSidecarFile(dng));
    await writeFile(sidecarPath, text, "utf8");
    return sidecarPath;
  }

  await writeFile(sidecarPath, JSON.stringify(dng, null, 2) + "\n", "utf8");
  return sidecarPath;
}
