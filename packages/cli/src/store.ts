import { stat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import fg from "fast-glob";
import { normalizeRepoRelativePath } from "./paths.js";

export type RepoStoreKind = "dng" | "denigma";

async function existsDir(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function detectRepoStore(repoRoot: string): Promise<RepoStoreKind> {
  const abs = resolve(repoRoot);
  if (await existsDir(join(abs, ".dng"))) return "dng";
  if (await existsDir(join(abs, ".denigma"))) return "denigma";
  return "dng";
}

export function dngSidecarPath(repoRoot: string, sourceRepoRelativePath: string): string {
  const normalized = normalizeRepoRelativePath(sourceRepoRelativePath);
  // .dng mirrors the repo layout and appends `.dng` suffix.
  return join(resolve(repoRoot), ".dng", ...normalized.split("/")) + ".dng";
}

export function denigmaSidecarPath(repoRoot: string, sourceRepoRelativePath: string): string {
  const normalized = normalizeRepoRelativePath(sourceRepoRelativePath);
  const dngName = normalized.replaceAll("/", "__") + ".dng.json";
  return join(resolve(repoRoot), ".denigma", "files", dngName);
}

export function sidecarDirForPath(absSidecarPath: string): string {
  return dirname(absSidecarPath);
}

export async function listDngSidecars(repoRoot: string): Promise<string[]> {
  const abs = resolve(repoRoot);
  const dir = join(abs, ".dng");
  return fg("**/*.dng", {
    cwd: dir,
    dot: true,
    onlyFiles: true,
    absolute: true,
    ignore: ["**/.git/**", "**/target/**", "**/node_modules/**"],
  });
}

