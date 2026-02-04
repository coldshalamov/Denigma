import { Command } from "commander";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { initRepo } from "./repo.js";
import { importComments } from "./comments.js";
import { syncFile } from "./sync.js";
import { syncAll } from "./sync-all.js";
import { getRepoStatus } from "./status.js";
import { trackFile } from "./track.js";
import { doctorRepo } from "./doctor.js";
import { trackAll } from "./track-all.js";

export function createProgram(): Command {
  const program = new Command();
  program.name("denigma").description("Denigma CLI").version("0.1.0");

  program
    .command("init")
    .description("Initialize Denigma metadata in the target repo")
    .option("--dir <path>", "Repo root (default: cwd)")
    .option("--store <store>", "Storage format: dng or denigma (default: dng)", "dng")
    .action(async (opts: { dir?: string; store?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      const store = opts.store === "denigma" ? "denigma" : "dng";
      await initRepo(repoRoot, store);
      process.stdout.write(`Initialized Denigma in ${repoRoot}\n`);
    });

  program
    .command("track")
    .description("Create a .dng file for a source file")
    .argument("<file>", "Path to a source file (repo-relative)")
    .option("--dir <path>", "Repo root (default: cwd)")
    .action(async (file: string, opts: { dir?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      const created = await trackFile(repoRoot, file);
      process.stdout.write(`Tracked ${file} -> ${created}\n`);
    });

  program
    .command("track-all")
    .description("Track all supported source files in a repo")
    .option("--dir <path>", "Repo root (default: cwd)")
    .action(async (opts: { dir?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      const result = await trackAll(repoRoot);
      process.stdout.write(`Tracked ${result.tracked}/${result.total} files (errors: ${result.errors})\n`);
      process.exitCode = result.errors > 0 ? 2 : 0;
    });

  program
    .command("sync")
    .description("Re-anchor .dng ranges based on the current source file")
    .argument("<file>", "Path to a source file (repo-relative)")
    .option("--dir <path>", "Repo root (default: cwd)")
    .action(async (file: string, opts: { dir?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      await syncFile(repoRoot, file);
      process.stdout.write(`Synced ${file}\n`);
    });

  program
    .command("sync-all")
    .description("Re-anchor all tracked .dng files based on the current sources")
    .option("--dir <path>", "Repo root (default: cwd)")
    .action(async (opts: { dir?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      const result = await syncAll(repoRoot);
      process.stdout.write(
        `Synced ${result.updated}/${result.total} tracked files (missing source: ${result.missingSource}, parse errors: ${result.parseErrors})\n`,
      );
    });

  program
    .command("status")
    .description("Show tracked files and segment health")
    .option("--dir <path>", "Repo root (default: cwd)")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts: { dir?: string; json?: boolean }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      const status = await getRepoStatus(repoRoot);

      if (opts.json) {
        process.stdout.write(JSON.stringify(status, null, 2) + "\n");
        return;
      }

      let totalOk = 0;
      let totalMissing = 0;
      let totalAmbiguous = 0;
      for (const f of status.files) {
        totalOk += f.segmentStatus.ok;
        totalMissing += f.segmentStatus.missing;
        totalAmbiguous += f.segmentStatus.ambiguous;
        process.stdout.write(
          `${f.sourcePath}  ok:${f.segmentStatus.ok} missing:${f.segmentStatus.missing} ambiguous:${f.segmentStatus.ambiguous}\n`,
        );
      }
      process.stdout.write(
        `TOTAL files:${status.files.length} segments ok:${totalOk} missing:${totalMissing} ambiguous:${totalAmbiguous}\n`,
      );
    });

  program
    .command("import-comments")
    .description("Import comment-only lines into the .dng markdown (does not modify source)")
    .argument("<file>", "Path to a source file (repo-relative)")
    .option("--dir <path>", "Repo root (default: cwd)")
    .action(async (file: string, opts: { dir?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      await importComments(repoRoot, file, { strip: false });
      process.stdout.write(`Imported comments for ${file}\n`);
    });

  program
    .command("strip-comments")
    .description("Import comment-only lines into the .dng markdown, then remove them from the source file")
    .argument("<file>", "Path to a source file (repo-relative)")
    .option("--dir <path>", "Repo root (default: cwd)")
    .action(async (file: string, opts: { dir?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      await importComments(repoRoot, file, { strip: true });
      process.stdout.write(`Stripped comments for ${file}\n`);
    });

  program
    .command("doctor")
    .description("Validate .denigma sidecars and report issues")
    .option("--dir <path>", "Repo root (default: cwd)")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts: { dir?: string; json?: boolean }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      const report = await doctorRepo(repoRoot);

      if (opts.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      } else {
        process.stdout.write(`Repo: ${report.repoRoot}\n`);
        process.stdout.write(`Sidecars: ${report.totalSidecars} (parsed: ${report.trackedFiles}, parse errors: ${report.parseErrors})\n`);
        process.stdout.write(`Missing sources: ${report.missingSourceFiles}\n`);
        process.stdout.write(`Stale source hash: ${report.staleSourceHash}\n`);
        process.stdout.write(`Segments: missing ${report.segmentsMissing}, ambiguous ${report.segmentsAmbiguous}\n`);

        if (report.ok) {
          process.stdout.write("OK: Denigma sidecars look consistent.\n");
        } else {
          process.stdout.write("Issues detected.\n");
          if (report.staleSourceHash > 0 || report.segmentsMissing > 0 || report.segmentsAmbiguous > 0) {
            process.stdout.write("Suggested: run `denigma sync-all --dir <repoRoot>`\n");
          }
          if (report.missingSourceFiles > 0) {
            process.stdout.write("Suggested: remove stale .dng files or restore the missing source files.\n");
          }
          if (report.parseErrors > 0) {
            process.stdout.write("Suggested: fix invalid JSON in .denigma/files or regenerate via `denigma track ...`.\n");
          }
        }
      }

      process.exitCode = report.ok ? 0 : 2;
    });

  program
    .command("serve")
    .description("Run the local Denigma web app for a repo")
    .option("--dir <path>", "Repo root (default: cwd)")
    .option("--port <port>", "Port (default: 8787)", "8787")
    .option("--ui-dist <path>", "Path to built UI dist/ (optional)")
    .action(async (opts: { dir?: string; port: string; uiDist?: string }) => {
      const repoRoot = resolve(opts.dir ?? process.cwd());
      const port = Number(opts.port);
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Invalid --port: ${opts.port}`);
      }

      let uiDistDir: string | undefined;
      if (opts.uiDist) {
        const candidate = resolve(opts.uiDist);
        const s = await stat(candidate);
        if (!s.isDirectory()) {
          throw new Error(`--ui-dist must be a directory: ${candidate}`);
        }
        uiDistDir = candidate;
      }

      const { createDenigmaServer } = await import("@denigma/server");
      const serverOptions = uiDistDir ? { repoRoot, uiDistDir } : { repoRoot };
      const app = createDenigmaServer(serverOptions);
      const server = app.listen(port, () => {
        process.stdout.write(`Denigma server running on http://localhost:${port}\n`);
        if (!uiDistDir) {
          process.stdout.write(
            "UI not configured. Pass --ui-dist <path-to-ui-dist> or run the UI dev server.\n",
          );
        }
      });

      const shutdown = () => {
        server.close(() => process.exit(0));
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });

  return program;
}
