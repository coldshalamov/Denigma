import type { DngRange, DngSegment } from "./schema.js";

export type RemapResult =
  | { ok: true; range: DngRange }
  | { ok: false; reason: "not-found" | "ambiguous" };

export type AnchorConfig = {
  contextLines: number;
};

export const DEFAULT_ANCHOR_CONFIG: AnchorConfig = {
  contextLines: 2,
};

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function isIgnorableContextLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (t.startsWith("//")) return true;
  if (t.startsWith("/*") || t.startsWith("*/")) return true;
  if (t === "*" || t.startsWith("* ")) return true;
  if (t.startsWith("#")) return true;
  if (t === "--" || t.startsWith("-- ")) return true;
  if (t.startsWith("<!--") || t.startsWith("-->")) return true;
  return false;
}

export function createAnchorForRange(
  fileText: string,
  range: DngRange,
  config: AnchorConfig = DEFAULT_ANCHOR_CONFIG,
): DngSegment["anchor"] {
  const lines = splitLines(fileText);
  const startIndex = range.startLine - 1;
  const endIndex = range.endLine - 1;

  if (startIndex < 0 || endIndex < 0 || startIndex >= lines.length || endIndex >= lines.length) {
    throw new Error("Range is out of bounds");
  }
  if (endIndex < startIndex) {
    throw new Error("Range end must be >= start");
  }

  const beforeStart = Math.max(0, startIndex - config.contextLines);
  const before = lines.slice(beforeStart, startIndex);
  const start = lines[startIndex] ?? "";

  const end = lines[endIndex] ?? "";
  const afterEndExclusive = Math.min(lines.length, endIndex + 1 + config.contextLines);
  const after = lines.slice(endIndex + 1, afterEndExclusive);

  return { before, start, end, after };
}

export function remapRangeByAnchor(
  fileText: string,
  anchor: DngSegment["anchor"],
): RemapResult {
  const lines = splitLines(fileText);
  type LineNormalizer = (line: string) => string;

  function findMatches(normalize?: LineNormalizer): Array<{ startIndex: number; endIndex: number }> {
    const norm: LineNormalizer = normalize ?? ((l) => l);
    const effectiveBefore = anchor.before.filter((l) => !isIgnorableContextLine(l));
    const effectiveAfter = anchor.after.filter((l) => !isIgnorableContextLine(l));

    const beforeLen = effectiveBefore.length;
    const afterLen = effectiveAfter.length;

    const normAnchor = {
      before: effectiveBefore.map(norm),
      start: norm(anchor.start),
      end: norm(anchor.end),
      after: effectiveAfter.map(norm),
    };

    const matches: Array<{ startIndex: number; endIndex: number }> = [];

    for (let startIndex = 0; startIndex < lines.length; startIndex++) {
      if (norm(lines[startIndex] ?? "") !== normAnchor.start) continue;

      if (beforeLen > 0) {
        const beforeStart = startIndex - beforeLen;
        if (beforeStart < 0) continue;
        let beforeOk = true;
        for (let j = 0; j < beforeLen; j++) {
          if (norm(lines[beforeStart + j] ?? "") !== normAnchor.before[j]) {
            beforeOk = false;
            break;
          }
        }
        if (!beforeOk) continue;
      }

      for (let endIndex = startIndex; endIndex < lines.length; endIndex++) {
        if (norm(lines[endIndex] ?? "") !== normAnchor.end) continue;

        if (afterLen > 0) {
        if (endIndex + afterLen >= lines.length) continue;
        let afterOk = true;
        for (let k = 0; k < afterLen; k++) {
          if (norm(lines[endIndex + 1 + k] ?? "") !== normAnchor.after[k]) {
            afterOk = false;
            break;
          }
        }
        if (!afterOk) continue;
      }

      matches.push({ startIndex, endIndex });
      break;
    }
  }

  return matches;
  }

  const strictMatches = findMatches();
  const matches = strictMatches.length > 0 ? strictMatches : findMatches((l) => l.trim());

  if (matches.length === 0) return { ok: false, reason: "not-found" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous" };

  const match = matches[0];
  if (!match) return { ok: false, reason: "not-found" };

  return {
    ok: true,
    range: {
      startLine: match.startIndex + 1,
      startCol: 0,
      endLine: match.endIndex + 1,
      endCol: 0,
    },
  };
}
