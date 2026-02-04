import { createAnchorForRange, DEFAULT_ANCHOR_CONFIG, type AnchorConfig } from "./anchors.js";
import type { DngFile, DngRange, DngSegment } from "./schema.js";
import { sha256Hex } from "./remap.js";

export type DngAnchor = DngSegment["anchor"];

export type TextSidecarMeta = {
  schemaVersion: 1;
  sourcePath: string;
  createdAt: string;
  updatedAt: string;
  sourceSha256: string;
};

export type TextSidecarSegment = {
  id: string;
  range: DngRange;
  markdown: string;
  status: NonNullable<DngSegment["status"]>;
  anchor: DngAnchor;
};

export type TextSidecarFile = {
  meta: TextSidecarMeta;
  segments: TextSidecarSegment[];
};

function bytesToBase64(bytes: Uint8Array): string {
  // Browser-safe + Node-safe.
  if (typeof btoa === "function") {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecodeToString(input: string): string {
  const padLen = (4 - (input.length % 4)) % 4;
  const padded = input.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(padLen);
  const bytes = base64ToBytes(padded);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function parseMetaLine(line: string): Partial<TextSidecarMeta> | null {
  if (!line.startsWith("@@@")) return null;
  const rest = line.slice(3).trim();
  const parts = rest.split(/\s+/g);
  if (parts[0] !== "denigma") return null;
  if (parts[1] !== "1") return null;

  const meta: Partial<TextSidecarMeta> = { schemaVersion: 1 };
  for (const p of parts.slice(2)) {
    const idx = p.indexOf("=");
    if (idx <= 0) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    if (!v) continue;
    if (k === "sourcePath") meta.sourcePath = v;
    if (k === "createdAt") meta.createdAt = v;
    if (k === "updatedAt") meta.updatedAt = v;
    if (k === "sourceSha256") meta.sourceSha256 = v;
  }
  return meta;
}

function formatMetaLine(meta: TextSidecarMeta): string {
  return (
    "@@@ denigma 1 " +
    `sourcePath=${meta.sourcePath} ` +
    `createdAt=${meta.createdAt} ` +
    `updatedAt=${meta.updatedAt} ` +
    `sourceSha256=${meta.sourceSha256}`
  );
}

function parseSegmentHeader(line: string): {
  id: string;
  range: DngRange;
  status: NonNullable<DngSegment["status"]>;
  anchor: DngAnchor;
} | null {
  if (!line.startsWith("@@")) return null;
  if (line.startsWith("@@@")) return null;
  const rest = line.slice(2).trim();

  // Expected tokens:
  // @@ seg-1 L10-L42 S:ok A:<b64url>
  const tokens = rest.split(/\s+/g);
  if (tokens.length < 2) return null;
  const id = tokens[0] || "";
  const rangeToken = tokens[1] || "";
  const rangeMatch = /^L(\d+)-L(\d+)$/i.exec(rangeToken);
  if (!id || !rangeMatch) return null;
  const startLine = Number(rangeMatch[1]);
  const endLine = Number(rangeMatch[2]);
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine <= 0 || endLine <= 0) return null;

  let status: NonNullable<DngSegment["status"]> = "ok";
  let anchor: DngAnchor | null = null;

  for (const t of tokens.slice(2)) {
    if (t.startsWith("S:")) {
      const s = t.slice(2);
      if (s === "missing" || s === "ambiguous") status = s;
      else status = "ok";
    } else if (t.startsWith("A:")) {
      const payload = t.slice(2);
      if (payload) {
        try {
          const json = base64UrlDecodeToString(payload);
          anchor = JSON.parse(json) as DngAnchor;
        } catch {
          // ignore
        }
      }
    }
  }

  if (!anchor) return null;
  return {
    id,
    range: { startLine, startCol: 0, endLine, endCol: 0 },
    status,
    anchor,
  };
}

function formatSegmentHeader(segment: TextSidecarSegment): string {
  const payload = base64UrlEncode(JSON.stringify(segment.anchor));
  const statusToken = `S:${segment.status}`;
  const anchorToken = `A:${payload}`;
  return `@@ ${segment.id} L${segment.range.startLine}-L${segment.range.endLine} ${statusToken} ${anchorToken}`;
}

export function parseTextSidecarFile(content: string): TextSidecarFile | null {
  const lines = content.split(/\r?\n/);
  const metaLine = lines[0] ?? "";
  const metaPartial = parseMetaLine(metaLine);
  if (!metaPartial?.sourcePath) return null;

  const segments: TextSidecarSegment[] = [];
  let current: ReturnType<typeof parseSegmentHeader> | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (!current) return;
    const markdown = buf.join("\n").trimEnd();
    segments.push({ ...current, markdown });
    buf = [];
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const header = parseSegmentHeader(line);
    if (header) {
      flush();
      current = header;
      continue;
    }
    buf.push(line);
  }
  flush();

  const createdAt = metaPartial.createdAt ?? new Date().toISOString();
  const updatedAt = metaPartial.updatedAt ?? createdAt;
  const sourceSha256 = metaPartial.sourceSha256 ?? "";

  return {
    meta: {
      schemaVersion: 1,
      sourcePath: metaPartial.sourcePath,
      createdAt,
      updatedAt,
      sourceSha256,
    },
    segments,
  };
}

export function formatTextSidecarFile(file: TextSidecarFile): string {
  const out: string[] = [];
  out.push(formatMetaLine(file.meta));
  out.push("");
  for (const seg of file.segments) {
    out.push(formatSegmentHeader(seg));
    out.push(seg.markdown.trimEnd());
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}

export function dngFileToTextSidecarFile(dng: DngFile): TextSidecarFile {
  return {
    meta: {
      schemaVersion: 1,
      sourcePath: dng.sourcePath,
      createdAt: dng.createdAt,
      updatedAt: dng.updatedAt,
      sourceSha256: dng.sourceSha256,
    },
    segments: dng.segments.map((s) => ({
      id: s.id,
      range: s.range,
      markdown: s.markdown,
      status: s.status ?? "ok",
      anchor: s.anchor,
    })),
  };
}

export function textSidecarToDngFile(
  parsed: TextSidecarFile,
  sourceText: string,
  opts?: { anchorConfig?: AnchorConfig },
): DngFile {
  const now = new Date().toISOString();
  const anchorConfig = opts?.anchorConfig ?? DEFAULT_ANCHOR_CONFIG;
  const sourceSha256 = sha256Hex(sourceText);

  const segments: DngSegment[] = parsed.segments.map((s) => ({
    id: s.id,
    range: s.range,
    markdown: s.markdown,
    status: s.status,
    anchor: s.anchor ?? createAnchorForRange(sourceText, s.range, anchorConfig),
  }));

  return {
    schemaVersion: 1,
    sourcePath: parsed.meta.sourcePath,
    sourceSha256: parsed.meta.sourceSha256 || sourceSha256,
    createdAt: parsed.meta.createdAt || now,
    updatedAt: parsed.meta.updatedAt || now,
    segments,
  };
}
