import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDngFile, remapDngFileToText, type DngFile, type DngSegment } from "@denigma/core";
import { encodeRepoRelativePathToDngName, normalizeRepoRelativePath } from "./paths.js";

type CommentBlock = {
  startLine: number;
  endLine: number;
  text: string;
};

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function looksLikeCommentOnlyLine(line: string, inBlockComment: boolean): { isComment: boolean; nextInBlock: boolean } {
  const trimmed = line.trim();
  if (!trimmed) return { isComment: false, nextInBlock: inBlockComment };

  if (inBlockComment) {
    if (trimmed.includes("*/")) return { isComment: true, nextInBlock: false };
    return { isComment: true, nextInBlock: true };
  }

  if (trimmed.startsWith("//")) return { isComment: true, nextInBlock: false };
  if (trimmed.startsWith("#")) return { isComment: true, nextInBlock: false };
  if (trimmed === "--" || trimmed.startsWith("-- ")) return { isComment: true, nextInBlock: false };

  if (trimmed.startsWith("/*")) {
    const endsSameLine = trimmed.includes("*/") && trimmed.indexOf("*/") > trimmed.indexOf("/*");
    return { isComment: true, nextInBlock: !endsSameLine };
  }

  return { isComment: false, nextInBlock: false };
}

function extractCommentBlocks(sourceText: string): CommentBlock[] {
  const lines = splitLines(sourceText);
  const blocks: CommentBlock[] = [];

  let i = 0;
  let inBlock = false;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const { isComment, nextInBlock } = looksLikeCommentOnlyLine(line, inBlock);

    if (!isComment) {
      i++;
      continue;
    }

    const startIndex = i;
    let endIndex = i;
    let currentInBlock = nextInBlock;

    i++;
    while (i < lines.length) {
      const l = lines[i] ?? "";
      const next = looksLikeCommentOnlyLine(l, currentInBlock);
      if (!next.isComment) break;
      endIndex = i;
      currentInBlock = next.nextInBlock;
      i++;
      if (!currentInBlock && !looksLikeCommentOnlyLine(lines[i - 1] ?? "", true).isComment) break;
    }

    const startLine = startIndex + 1;
    const endLine = endIndex + 1;
    const text = lines.slice(startIndex, endIndex + 1).join("\n");
    blocks.push({ startLine, endLine, text });

    inBlock = currentInBlock;
  }

  return blocks;
}

function findAttachLine(lines: string[], block: CommentBlock): number {
  let idx = block.endLine; // 1-based, so next line is idx+1; we start scan at idx
  let inBlock = false;
  while (idx < lines.length) {
    const line = lines[idx] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      idx++;
      continue;
    }
    const { isComment, nextInBlock } = looksLikeCommentOnlyLine(line, inBlock);
    inBlock = nextInBlock;
    if (isComment) {
      idx++;
      continue;
    }
    return idx + 1;
  }
  return block.startLine;
}

function pickSegmentForLine(segments: DngSegment[], lineNo: number): DngSegment | null {
  const inRange = segments.find((s) => lineNo >= s.range.startLine && lineNo <= s.range.endLine);
  if (inRange) return inRange;
  const next = segments.find((s) => s.range.startLine >= lineNo);
  if (next) return next;
  return segments.length > 0 ? (segments[segments.length - 1] ?? null) : null;
}

function appendImportedComment(segment: DngSegment, block: CommentBlock): DngSegment {
  const marker = `(from L${block.startLine}–L${block.endLine})`;
  if (segment.markdown.includes(marker)) return segment;

  const addition =
    `\n\n---\n\n### Imported comments\n\n- ${marker}\n\n` +
    "```text\n" +
    `${block.text}\n` +
    "```\n";

  return { ...segment, markdown: segment.markdown + addition };
}

export type ImportCommentsOptions = {
  strip?: boolean;
};

export async function importComments(
  repoRoot: string,
  sourceRepoRelativePath: string,
  options: ImportCommentsOptions = {},
): Promise<{ dng: DngFile; stripped: boolean }> {
  const normalizedSourcePath = normalizeRepoRelativePath(sourceRepoRelativePath);
  const denigmaFilesDir = join(repoRoot, ".denigma", "files");
  const dngPath = join(denigmaFilesDir, encodeRepoRelativePathToDngName(normalizedSourcePath));
  const sourcePath = join(repoRoot, normalizedSourcePath);

  const sourceText = await readFile(sourcePath, "utf8");
  const sourceLines = splitLines(sourceText);

  const dngText = await readFile(dngPath, "utf8");
  const parsed = parseDngFile(JSON.parse(dngText));

  const commentBlocks = extractCommentBlocks(sourceText);
  if (commentBlocks.length === 0 && !options.strip) {
    return { dng: parsed, stripped: false };
  }

  const nextSegments: DngSegment[] = parsed.segments.map((s) => ({ ...s }));

  for (const block of commentBlocks) {
    const attachLine = findAttachLine(sourceLines, block);
    const seg = pickSegmentForLine(nextSegments, attachLine);
    if (!seg) continue;
    const idx = nextSegments.findIndex((s) => s.id === seg.id);
    if (idx < 0) continue;
    nextSegments[idx] = appendImportedComment(seg, block);
  }

  const dngWithImports: DngFile = {
    ...parsed,
    updatedAt: new Date().toISOString(),
    segments: nextSegments,
  };

  if (!options.strip) {
    await writeFile(dngPath, JSON.stringify(dngWithImports, null, 2) + "\n", "utf8");
    return { dng: dngWithImports, stripped: false };
  }

  // Strip comment-only lines, then remap using existing anchors.
  const keep: boolean[] = [];
  let inBlock = false;
  for (const line of sourceLines) {
    const { isComment, nextInBlock } = looksLikeCommentOnlyLine(line, inBlock);
    inBlock = nextInBlock;
    keep.push(!isComment);
  }

  const strippedLines = sourceLines.filter((_l, idx) => keep[idx] !== false);
  const strippedText = strippedLines.join("\n");
  await writeFile(sourcePath, strippedText.endsWith("\n") ? strippedText : strippedText + "\n", "utf8");

  const remapped = remapDngFileToText(dngWithImports, strippedText);
  await writeFile(dngPath, JSON.stringify(remapped, null, 2) + "\n", "utf8");
  return { dng: remapped, stripped: true };
}

