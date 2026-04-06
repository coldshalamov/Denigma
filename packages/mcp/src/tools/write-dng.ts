import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import {
  parseDngFile,
  parseTextSidecarFile,
  textSidecarToDngFile,
  dngFileToTextSidecarFile,
  formatTextSidecarFile,
  type DngSegment,
} from "@denigma/core";
import { detectRepoStore, denigmaSidecarPath, dngSidecarPath } from "@denigma/cli/src/store.js";

export const writeDngSchema = {
  name: "write_dng_entry",
  description:
    "Write or update a Denigma sidecar segment for a source file, tied to a log entry. " +
    "Call this after every file edit — one call per modified file. " +
    "Requires the entry_id returned by log_prompt.",
  inputSchema: {
    type: "object" as const,
    properties: {
      repo_root: {
        type: "string",
        description: "Absolute path to the root of the target repository.",
      },
      entry_id: {
        type: "string",
        description: "The entry_id returned by a prior log_prompt call in this session.",
      },
      source_file: {
        type: "string",
        description: "Repo-relative path of the source file that was edited.",
      },
      segment_id: {
        type: "string",
        description:
          "ID for the sidecar segment. Use a short, descriptive slug (e.g. 'append-entry-fn'). " +
          "If the segment already exists it will be updated.",
      },
      markdown: {
        type: "string",
        description:
          "Markdown annotation describing what this segment does, why it exists, and how it relates to the logged intent.",
      },
      start_line: {
        type: "number",
        description: "1-based start line of the code region this segment annotates.",
      },
      end_line: {
        type: "number",
        description: "1-based end line of the code region.",
      },
    },
    required: ["repo_root", "entry_id", "source_file", "segment_id", "markdown", "start_line", "end_line"],
  },
} as const;

export const writeDngInputSchema = z.object({
  repo_root: z.string().min(1),
  entry_id: z.string().min(1),
  source_file: z.string().min(1),
  segment_id: z.string().min(1),
  markdown: z.string().min(1),
  start_line: z.number().int().positive(),
  end_line: z.number().int().positive(),
});

export type WriteDngInput = z.infer<typeof writeDngInputSchema>;

export async function handleWriteDng(input: WriteDngInput): Promise<{ sidecar_path: string; message: string }> {
  const absRoot = resolve(input.repo_root);
  const store = await detectRepoStore(absRoot);

  const sidecarPath =
    store === "dng"
      ? dngSidecarPath(absRoot, input.source_file)
      : denigmaSidecarPath(absRoot, input.source_file);

  const sourceAbsPath = join(absRoot, ...input.source_file.replace(/^\.\//, "").split("/"));

  if (!existsSync(sourceAbsPath)) {
    throw new Error(`Source file not found: ${input.source_file}`);
  }

  const sourceText = await readFile(sourceAbsPath, "utf8");
  const lines = sourceText.split("\n");

  // Build anchor from the lines being annotated
  const startIdx = input.start_line - 1;
  const endIdx = input.end_line - 1;
  const startLine = lines[startIdx] ?? "";
  const endLine = lines[endIdx] ?? startLine;
  const before = lines.slice(Math.max(0, startIdx - 2), startIdx);
  const after = lines.slice(endIdx + 1, Math.min(lines.length, endIdx + 3));

  const newSegment: DngSegment = {
    id: input.segment_id,
    range: {
      startLine: input.start_line,
      startCol: 0,
      endLine: input.end_line,
      endCol: (lines[endIdx] ?? "").length,
    },
    anchor: { before, start: startLine, end: endLine, after },
    markdown: `<!-- entry:${input.entry_id} -->\n\n${input.markdown}`,
  };

  // Load existing sidecar if present, otherwise create a fresh structure.
  let segments: DngSegment[] = [];
  let existingData: { sourcePath: string; createdAt: string } | null = null;

  if (existsSync(sidecarPath)) {
    try {
      const raw = await readFile(sidecarPath, "utf8");
      let parsed;
      if (store === "dng") {
        const sidecar = parseTextSidecarFile(raw);
        if (sidecar) {
          parsed = textSidecarToDngFile(sidecar, sourceText);
        }
      } else {
        parsed = parseDngFile(JSON.parse(raw));
      }
      if (parsed) {
        segments = parsed.segments.filter((s) => s.id !== input.segment_id);
        existingData = { sourcePath: parsed.sourcePath, createdAt: parsed.createdAt };
      }
    } catch {
      // If parsing fails, start fresh for this file.
    }
  }

  segments.push(newSegment);
  segments.sort((a, b) => a.range.startLine - b.range.startLine);

  const now = new Date().toISOString();
  const dngFile = {
    schemaVersion: 1 as const,
    sourcePath: input.source_file.replace(/^\.\//, ""),
    sourceSha256: sourceText, // will be hashed by createDngFile internals
    createdAt: existingData?.createdAt ?? now,
    updatedAt: now,
    segments,
  };

  await mkdir(dirname(sidecarPath), { recursive: true });

  if (store === "dng") {
    const textSidecar = dngFileToTextSidecarFile(dngFile as Parameters<typeof dngFileToTextSidecarFile>[0]);
    await writeFile(sidecarPath, formatTextSidecarFile(textSidecar), "utf8");
  } else {
    await writeFile(sidecarPath, JSON.stringify(dngFile, null, 2) + "\n", "utf8");
  }

  return {
    sidecar_path: sidecarPath,
    message: `Wrote segment '${input.segment_id}' to ${sidecarPath} (tied to entry ${input.entry_id}).`,
  };
}
