import type { SegmentInput } from "@denigma/core";

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function isLikelyStartOfBlock(sourcePath: string | undefined, line: string): boolean {
  const ext = sourcePath?.split(".").pop()?.toLowerCase();

  if (ext === "rs") {
    return (
      /^\s*(pub(\([^)]*\))?\s+)?(async\s+)?fn\s+\w+/.test(line) ||
      /^\s*(pub(\([^)]*\))?\s+)?struct\s+\w+/.test(line) ||
      /^\s*(pub(\([^)]*\))?\s+)?enum\s+\w+/.test(line) ||
      /^\s*impl(\s+<[^>]+>)?\s+/.test(line) ||
      /^\s*mod\s+\w+/.test(line)
    );
  }

  return (
    /^\s*(export\s+)?(default\s+)?(async\s+)?function\s+\w+/.test(line) ||
    /^\s*(export\s+)?class\s+\w+/.test(line) ||
    /^\s*def\s+\w+/.test(line) ||
    /^\s*(export\s+)?const\s+\w+\s*=\s*\(/.test(line) ||
    /^\s*(export\s+)?const\s+\w+\s*=\s*async\s*\(/.test(line)
  );
}

function fileIntroMarkdown(sourcePath: string, sourceText: string): string {
  const ext = sourcePath.split(".").pop()?.toLowerCase();
  const lines = splitLines(sourceText);
  const outline: string[] = [];

  if (ext === "rs") {
    for (const line of lines) {
      const t = line.trim();
      const mod = /^(pub(\([^)]*\))?\s+)?mod\s+(\w+)/.exec(t);
      if (mod) outline.push(`- module: \`${mod[3]}\``);
      const fn = /^(pub(\([^)]*\))?\s+)?(async\s+)?fn\s+(\w+)/.exec(t);
      if (fn) outline.push(`- fn: \`${fn[4]}\``);
      const st = /^(pub(\([^)]*\))?\s+)?struct\s+(\w+)/.exec(t);
      if (st) outline.push(`- struct: \`${st[3]}\``);
      const en = /^(pub(\([^)]*\))?\s+)?enum\s+(\w+)/.exec(t);
      if (en) outline.push(`- enum: \`${en[3]}\``);
      const tr = /^(pub(\([^)]*\))?\s+)?trait\s+(\w+)/.exec(t);
      if (tr) outline.push(`- trait: \`${tr[3]}\``);
    }
  } else if (ext === "py") {
    for (const line of lines) {
      const t = line.trim();
      const cl = /^class\s+(\w+)/.exec(t);
      if (cl) outline.push(`- class: \`${cl[1]}\``);
      const fn = /^(async\s+)?def\s+(\w+)/.exec(t);
      if (fn) outline.push(`- def: \`${fn[2]}\``);
    }
  }

  return (
    `# ${sourcePath}\n\n` +
    "This is a Denigma sidecar file. It explains the corresponding source file in plain English.\n\n" +
    (outline.length > 0 ? `Quick outline:\n${outline.slice(0, 24).join("\n")}\n\n` : "") +
    "Recommended reading order:\n" +
    "- Start with the first segment to understand the file's purpose\n" +
    "- Then read each segment in order, cross-checking with the code\n\n"
  );
}

function explainBlockTemplate(sourcePath: string | undefined, firstLine: string): string {
  const ext = sourcePath?.split(".").pop()?.toLowerCase();
  const trimmed = firstLine.trim();

  if (ext === "rs") {
    const mod = /^(pub(\([^)]*\))?\s+)?mod\s+(\w+)\s*;?/.exec(trimmed);
    if (mod) {
      return (
        `### Module declaration: \`${mod[3]}\`\n\n` +
        "What this does:\n" +
        `- Declares the \`${mod[3]}\` module as part of this crate.\n` +
        "- The implementation is typically in a sibling file or folder (e.g. `mod.rs` or `<name>.rs`).\n"
      );
    }
    const fn = /^(pub(\([^)]*\))?\s+)?(async\s+)?fn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^{]+))?/.exec(trimmed);
    if (fn) {
      const name = fn[4];
      const params = (fn[5] || "").trim();
      const ret = (fn[6] || "").trim();
      return (
        `### Function: \`${name}\`\n\n` +
        "What it does:\n" +
        "- Describe the purpose in one sentence.\n\n" +
        (params ? `Inputs:\n- \`${params}\`\n\n` : "") +
        (ret ? `Returns:\n- \`${ret}\`\n\n` : "") +
        "Key logic:\n- Walk through the critical branches/loops.\n"
      );
    }
    const st = /^(pub(\([^)]*\))?\s+)?struct\s+(\w+)/.exec(trimmed);
    if (st) {
      return `### Struct: \`${st[3]}\`\n\n- Explain what this data type represents.\n- Call out important fields and invariants.\n`;
    }
    const en = /^(pub(\([^)]*\))?\s+)?enum\s+(\w+)/.exec(trimmed);
    if (en) {
      return `### Enum: \`${en[3]}\`\n\n- Explain what this enum represents.\n- Describe what each variant means.\n`;
    }
    const im = /^impl(\s+<[^>]+>)?\s+([A-Za-z0-9_:.]+)/.exec(trimmed);
    if (im) {
      return `### impl block: \`${im[2]}\`\n\n- Summarize which methods/traits are implemented here.\n`;
    }
    return "### Block\n\n- Explain what this section is responsible for.\n";
  }

  if (ext === "py") {
    const fn = /^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*:/.exec(trimmed);
    if (fn) {
      return (
        `### Function: \`${fn[2]}\`\n\n` +
        "What it does:\n- Describe the purpose in one sentence.\n\n" +
        `Inputs:\n- \`${(fn[3] || "").trim()}\`\n\n` +
        "Outputs:\n- Describe return value / side effects.\n"
      );
    }
    const cl = /^class\s+(\w+)/.exec(trimmed);
    if (cl) return `### Class: \`${cl[1]}\`\n\n- Explain what this class represents.\n- Note key methods and invariants.\n`;
  }

  return "### Block\n\n- Explain what this section is responsible for.\n";
}

export function scanSegments(sourceText: string, sourcePath?: string): SegmentInput[] {
  const lines = splitLines(sourceText);
  const starts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (isLikelyStartOfBlock(sourcePath, line)) starts.push(i);
  }

  if (starts.length === 0) {
    const endLine = Math.max(1, lines.length);
    return [
      {
        id: "seg-1",
        range: { startLine: 1, startCol: 0, endLine, endCol: 0 },
        markdown: (sourcePath ? fileIntroMarkdown(sourcePath, sourceText) : "") + "TODO: Explain this file end-to-end.\n",
      },
    ];
  }

  const segments: SegmentInput[] = [];
  for (let s = 0; s < starts.length; s++) {
    const startIndex = starts[s];
    if (startIndex === undefined) continue;
    const nextStartIndex = starts[s + 1] ?? lines.length;
    const startLine = startIndex + 1;
    const endLine = Math.max(startLine, nextStartIndex);
    const firstLine = lines[startIndex] ?? "";

    segments.push({
      id: `seg-${s + 1}`,
      range: { startLine, startCol: 0, endLine, endCol: 0 },
      markdown:
        (s === 0 && sourcePath ? fileIntroMarkdown(sourcePath, sourceText) : "") +
        explainBlockTemplate(sourcePath, firstLine),
    });
  }

  return segments;
}
