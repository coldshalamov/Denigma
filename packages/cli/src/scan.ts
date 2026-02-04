import type { SegmentInput } from "@denigma/core";

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function isLikelyStartOfBlock(line: string): boolean {
  return (
    /^\s*(export\s+)?(default\s+)?(async\s+)?function\s+\w+/.test(line) ||
    /^\s*(export\s+)?class\s+\w+/.test(line) ||
    /^\s*def\s+\w+/.test(line) ||
    /^\s*(export\s+)?const\s+\w+\s*=\s*\(/.test(line) ||
    /^\s*(export\s+)?const\s+\w+\s*=\s*async\s*\(/.test(line)
  );
}

export function scanSegments(sourceText: string): SegmentInput[] {
  const lines = splitLines(sourceText);
  const starts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (isLikelyStartOfBlock(line)) starts.push(i);
  }

  if (starts.length === 0) {
    const endLine = Math.max(1, lines.length);
    return [
      {
        id: "seg-1",
        range: { startLine: 1, startCol: 0, endLine, endCol: 0 },
        markdown:
          "TODO: Explain this file end-to-end.\n\n" +
          "Suggested approach:\n" +
          "- Describe the overall purpose\n" +
          "- Walk through each section\n" +
          "- Note inputs/outputs and edge cases\n",
      },
    ];
  }

  const segments: SegmentInput[] = [];
  for (let s = 0; s < starts.length; s++) {
    const startIndex = starts[s];
    const nextStartIndex = starts[s + 1] ?? lines.length;
    const startLine = (startIndex ?? 0) + 1;
    const endLine = Math.max(startLine, nextStartIndex);

    segments.push({
      id: `seg-${s + 1}`,
      range: { startLine, startCol: 0, endLine, endCol: 0 },
      markdown: "TODO: Explain this block in plain English, line-by-line where helpful.",
    });
  }

  return segments;
}

