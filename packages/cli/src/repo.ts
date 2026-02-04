import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type DenigmaRepoConfig = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  filesDir: string;
};

export async function initRepo(repoRoot: string): Promise<void> {
  const denigmaDir = join(repoRoot, ".denigma");
  await mkdir(denigmaDir, { recursive: true });
  await mkdir(join(denigmaDir, "files"), { recursive: true });

  const now = new Date().toISOString();
  const config: DenigmaRepoConfig = {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    filesDir: ".denigma/files",
  };

  const configPath = join(denigmaDir, "denigma.json");
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

