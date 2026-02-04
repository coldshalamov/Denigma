import fg from "fast-glob";
import { resolve } from "node:path";
import { trackFile } from "./track.js";

export type TrackAllResult = {
  total: number;
  tracked: number;
  errors: number;
};

export async function trackAll(repoRoot: string, opts?: { patterns?: string[] }): Promise<TrackAllResult> {
  const absRepoRoot = resolve(repoRoot);
  const patterns = opts?.patterns ?? [
    "**/*.rs",
    "**/*.py",
    "**/*.toml",
    "**/*.md",
  ];

  const ignore = [
    ".git/**",
    "target/**",
    "node_modules/**",
    ".dng/**",
    ".denigma/**",
    "Cargo.lock",
    "**/*.pdf",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.zip",
  ];

  const files = await fg(patterns, { cwd: absRepoRoot, onlyFiles: true, dot: false, ignore });

  let tracked = 0;
  let errors = 0;
  for (const relPath of files) {
    try {
      await trackFile(absRepoRoot, relPath);
      tracked++;
    } catch {
      errors++;
    }
  }

  return { total: files.length, tracked, errors };
}

