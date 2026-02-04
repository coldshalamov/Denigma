import type { DngFile, DngSegment } from "@denigma/core";

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function escapeFilenamePart(part: string): string {
  return part.replaceAll(/[<>:"/\\|?*]/g, "_");
}

function guessCodeFenceLanguage(sourcePath: string): string {
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith(".ts")) return "ts";
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".js")) return "js";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".py")) return "py";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".go")) return "go";
  return "";
}

function segmentHeader(seg: DngSegment): string {
  const status = seg.status ?? "ok";
  return `## ${seg.id} (L${seg.range.startLine}–L${seg.range.endLine}) · ${status}`;
}

export function generateMarkdownExport(input: {
  sourcePath: string;
  sourceText: string;
  dng: DngFile;
}): string {
  const lines = splitLines(input.sourceText);
  const lang = guessCodeFenceLanguage(input.sourcePath);

  const out: string[] = [];
  out.push(`# Denigma export: ${input.sourcePath}`);
  out.push("");
  out.push(`- Updated: ${input.dng.updatedAt}`);
  out.push(`- Source SHA-256: ${input.dng.sourceSha256}`);
  out.push("");
  out.push("---");
  out.push("");

  for (const seg of input.dng.segments) {
    out.push(segmentHeader(seg));
    out.push("");
    out.push(seg.markdown.trim() ? seg.markdown.trim() : "*No explanation.*");
    out.push("");

    const start = Math.max(1, seg.range.startLine);
    const end = Math.min(lines.length, seg.range.endLine);
    const excerpt = lines.slice(start - 1, end).join("\n");

    out.push("```" + lang);
    out.push(excerpt);
    out.push("```");
    out.push("");
  }

  return out.join("\n");
}

export function exportFilenameForSourcePath(sourcePath: string): string {
  const base = escapeFilenamePart(sourcePath.replaceAll("\\", "/").replaceAll("/", "__"));
  return `${base}.denigma.md`;
}

export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
