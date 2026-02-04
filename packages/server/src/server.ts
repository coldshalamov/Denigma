import express from "express";
import cors from "cors";
import fg from "fast-glob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, posix as posixPath, sep as pathSep } from "node:path";
import {
  dngFileToTextSidecarFile,
  formatTextSidecarFile,
  parseDngFile,
  parseTextSidecarFile,
  remapDngFileToText,
  textSidecarToDngFile,
  type DngFile,
} from "@denigma/core";
import { z } from "zod";

export type CreateDenigmaServerOptions = {
  repoRoot: string;
  uiDistDir?: string;
};

const SaveFileBodySchema = z.object({
  dng: z.unknown(),
});

function normalizeRepoRelativePath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes("\0")) return null;
  if (trimmed.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(trimmed)) return null;

  const normalized = posixPath.normalize(trimmed.replaceAll("\\", "/"));
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") return null;
  return normalized;
}

function encodeRepoRelativePathToDngName(repoRelativePath: string): string {
  const normalized = repoRelativePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
  return `${normalized.replaceAll("/", "__")}.dng.json`;
}

function computeSegmentStatusCounts(dng: DngFile): { ok: number; missing: number; ambiguous: number } {
  let ok = 0;
  let missing = 0;
  let ambiguous = 0;
  for (const seg of dng.segments) {
    if (seg.status === "missing") missing++;
    else if (seg.status === "ambiguous") ambiguous++;
    else ok++;
  }
  return { ok, missing, ambiguous };
}

export function createDenigmaServer(options: CreateDenigmaServerOptions): express.Express {
  const repoRoot = resolve(options.repoRoot);
  const dngDir = join(repoRoot, ".dng");
  const denigmaFilesDir = join(repoRoot, ".denigma", "files");
  const store: "dng" | "denigma" = existsSync(dngDir) ? "dng" : "denigma";

  function sidecarPathForSource(normalizedSourcePath: string): string {
    if (store === "dng") {
      const parts = normalizedSourcePath.split("/").join(pathSep);
      return join(dngDir, parts) + ".dng";
    }
    return join(denigmaFilesDir, encodeRepoRelativePathToDngName(normalizedSourcePath));
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/meta", async (_req, res) => {
    res.json({ store });
  });

  app.get("/api/sidecar", async (req, res) => {
    const normalizedSourcePath = normalizeRepoRelativePath(String(req.query.path ?? ""));
    if (!normalizedSourcePath) {
      res.status(400).json({ error: "Missing required query param: path" });
      return;
    }

    const dngPath = sidecarPathForSource(normalizedSourcePath);
    try {
      const text = await readFile(dngPath, "utf8");
      res.type(store === "dng" ? "text/plain" : "application/json").send(text);
    } catch {
      res.status(404).json({ error: "No sidecar found for path" });
    }
  });

  app.get("/api/files", async (_req, res) => {
    let entries: string[] = [];
    if (store === "dng") {
      try {
        entries = await fg("**/*.dng", { cwd: dngDir, dot: true, onlyFiles: true, absolute: true });
      } catch {
        entries = [];
      }
    } else {
      try {
        entries = await fg("**/*.dng.json", {
          cwd: denigmaFilesDir,
          dot: false,
          onlyFiles: true,
          absolute: true,
        });
      } catch {
        // If .denigma/files doesn't exist yet, return empty list.
        entries = [];
      }
    }

    const files: Array<{
      sourcePath: string;
      updatedAt: string;
      segmentStatus: { ok: number; missing: number; ambiguous: number };
    }> = [];

    for (const filePath of entries) {
      try {
        const text = await readFile(filePath, "utf8");
        if (store === "dng") {
          const sidecar = parseTextSidecarFile(text);
          if (!sidecar) throw new Error("Invalid .dng sidecar");

          const segmentStatus = { ok: 0, missing: 0, ambiguous: 0 };
          for (const seg of sidecar.segments) {
            if (seg.status === "missing") segmentStatus.missing++;
            else if (seg.status === "ambiguous") segmentStatus.ambiguous++;
            else segmentStatus.ok++;
          }

          files.push({
            sourcePath: sidecar.meta.sourcePath,
            updatedAt: sidecar.meta.updatedAt,
            segmentStatus,
          });
          continue;
        }

        const parsed = parseDngFile(JSON.parse(text));
        files.push({
          sourcePath: parsed.sourcePath,
          updatedAt: parsed.updatedAt,
          segmentStatus: computeSegmentStatusCounts(parsed),
        });
      } catch {
        // Skip unreadable/invalid entries.
      }
    }

    files.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
    res.json({ files });
  });

  app.get("/api/file", async (req, res) => {
    const normalizedSourcePath = normalizeRepoRelativePath(String(req.query.path ?? ""));
    if (!normalizedSourcePath) {
      res.status(400).json({ error: "Missing required query param: path" });
      return;
    }

    const dngPath = sidecarPathForSource(normalizedSourcePath);
    const sourceAbsPath = join(repoRoot, normalizedSourcePath.split("/").join(pathSep));
    let sourceText: string;
    try {
      sourceText = await readFile(sourceAbsPath, "utf8");
    } catch {
      res.status(404).json({ error: "Source file not found" });
      return;
    }

    let dng: DngFile;
    try {
      const dngText = await readFile(dngPath, "utf8");
      if (store === "dng") {
        const sidecar = parseTextSidecarFile(dngText);
        if (!sidecar) throw new Error("Invalid .dng sidecar");
        dng = textSidecarToDngFile(sidecar, sourceText);
      } else {
        dng = parseDngFile(JSON.parse(dngText));
      }
    } catch {
      res.status(404).json({ error: "No .dng file found for path" });
      return;
    }

    res.json({ sourcePath: normalizedSourcePath, sourceText, dng });
  });

  app.put("/api/file", async (req, res) => {
    const normalizedSourcePath = normalizeRepoRelativePath(String(req.query.path ?? ""));
    if (!normalizedSourcePath) {
      res.status(400).json({ error: "Missing required query param: path" });
      return;
    }

    const parsedBody = SaveFileBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const dng = parseDngFile(parsedBody.data.dng);
    if (dng.sourcePath !== normalizedSourcePath) {
      res.status(400).json({ error: "Body dng.sourcePath must match query param: path" });
      return;
    }
    const dngPath = sidecarPathForSource(normalizedSourcePath);
    if (store === "dng") {
      await mkdir(join(dngDir, ...normalizedSourcePath.split("/").slice(0, -1)), { recursive: true });
      await writeFile(dngPath, formatTextSidecarFile(dngFileToTextSidecarFile(dng)), "utf8");
    } else {
      await writeFile(dngPath, JSON.stringify(dng, null, 2) + "\n", "utf8");
    }
    res.json({ ok: true });
  });

  app.post("/api/sync", async (req, res) => {
    const normalizedSourcePath = normalizeRepoRelativePath(String(req.query.path ?? ""));
    if (!normalizedSourcePath) {
      res.status(400).json({ error: "Missing required query param: path" });
      return;
    }

    const dngPath = sidecarPathForSource(normalizedSourcePath);
    const sourceAbsPath = join(repoRoot, normalizedSourcePath.split("/").join(pathSep));
    let sourceText: string;
    try {
      sourceText = await readFile(sourceAbsPath, "utf8");
    } catch {
      res.status(404).json({ error: "Source file not found" });
      return;
    }

    let dng: DngFile;
    try {
      const dngText = await readFile(dngPath, "utf8");
      if (store === "dng") {
        const sidecar = parseTextSidecarFile(dngText);
        if (!sidecar) throw new Error("Invalid .dng sidecar");
        dng = textSidecarToDngFile(sidecar, sourceText);
      } else {
        dng = parseDngFile(JSON.parse(dngText));
      }
    } catch {
      res.status(404).json({ error: "No .dng file found for path" });
      return;
    }

    const remapped = remapDngFileToText(dng, sourceText);
    if (store === "dng") {
      await writeFile(dngPath, formatTextSidecarFile(dngFileToTextSidecarFile(remapped)), "utf8");
    } else {
      await writeFile(dngPath, JSON.stringify(remapped, null, 2) + "\n", "utf8");
    }
    res.json({ ok: true, dng: remapped });
  });

  if (options.uiDistDir) {
    const uiDist = resolve(options.uiDistDir);
    app.use(express.static(uiDist));
    app.get("*", async (_req, res) => {
      const indexPath = join(uiDist, "index.html");
      res.type("html").send(await readFile(indexPath, "utf8"));
    });
  }

  return app;
}
