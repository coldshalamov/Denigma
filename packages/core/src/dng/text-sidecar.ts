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
  anchor?: DngAnchor;
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

function parseSegmentHeaderLine(
  line: string,
): { id: string; range: DngRange; meta?: { status?: NonNullable<DngSegment["status"]>; anchor?: DngAnchor } } | null {
  if (!line.startsWith("@@")) return null;
  if (line.startsWith("@@@")) return null;
  const rest = line.slice(2).trim();

  const tokens = rest.split(/\s+/g);
  if (tokens.length < 2) return null;
  const id = tokens[0] || "";
  const rangeToken = tokens[1] || "";
  const rangeMatch = /^L(\d+)-L(\d+)$/i.exec(rangeToken);
  if (!id || !rangeMatch) return null;
  const startLine = Number(rangeMatch[1]);
  const endLine = Number(rangeMatch[2]);
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine <= 0 || endLine <= 0) return null;

  const meta = parseSegmentMetaFromTokens(tokens.slice(2));
  const hasMeta = Boolean(meta.status || meta.anchor);

  return {
    id,
    range: { startLine, startCol: 0, endLine, endCol: 0 },
    ...(hasMeta ? { meta } : {}),
  };
}

function parseSegmentMetaFromTokens(tokens: string[]): { status?: NonNullable<DngSegment["status"]>; anchor?: DngAnchor } {
  let status: NonNullable<DngSegment["status"]> | undefined;
  let anchor: DngAnchor | undefined;
  for (const t of tokens) {
    if (t.startsWith("S:")) {
      const s = t.slice(2);
      if (s === "missing" || s === "ambiguous") status = s;
      else if (s === "ok") status = "ok";
    } else if (t.startsWith("A:")) {
      const payload = t.slice(2);
      if (!payload) continue;
      try {
        const json = base64UrlDecodeToString(payload);
        anchor = JSON.parse(json) as DngAnchor;
      } catch {
        // ignore
      }
    }
  }

  const out: { status?: NonNullable<DngSegment["status"]>; anchor?: DngAnchor } = {};
  if (status) out.status = status;
  if (anchor) out.anchor = anchor;
  return out;
}

function parseSegmentMetaLine(line: string): { status?: NonNullable<DngSegment["status"]>; anchor?: DngAnchor } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("<!--") || !trimmed.endsWith("-->")) return null;
  const inner = trimmed.slice(4, -3).trim();
  if (!inner.startsWith("denigma")) return null;
  const tokens = inner.split(/\s+/g).slice(1); // drop 'denigma'
  return parseSegmentMetaFromTokens(tokens);
}

function formatSegmentHeaderLine(segment: TextSidecarSegment): string {
  return `@@ ${segment.id} L${segment.range.startLine}-L${segment.range.endLine}`;
}

function formatSegmentMetaLine(segment: TextSidecarSegment): string {
  const parts: string[] = [`S:${segment.status}`];
  if (segment.anchor) {
    const payload = base64UrlEncode(JSON.stringify(segment.anchor));
    parts.push(`A:${payload}`);
  }
  return `<!-- denigma ${parts.join(" ")} -->`;
}

export function parseTextSidecarFile(content: string): TextSidecarFile | null {
  const lines = content.split(/\r?\n/);
  const metaLine = lines[0] ?? "";
  const metaPartial = parseMetaLine(metaLine);
  if (!metaPartial?.sourcePath) return null;

  const segments: TextSidecarSegment[] = [];
  let currentHeader: { id: string; range: DngRange } | null = null;
  let currentMeta: { status: NonNullable<DngSegment["status"]>; anchor?: DngAnchor } | null = null;
  let expectingMetaLine = false;
  let buf: string[] = [];

  const flush = () => {
    if (!currentHeader) return;
    const meta = currentMeta ?? { status: "missing" as const };
    const markdown = buf.join("\n").trimEnd();
    segments.push({ ...currentHeader, ...meta, markdown });
    buf = [];
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const header = parseSegmentHeaderLine(line);
    if (header) {
      flush();
      currentHeader = { id: header.id, range: header.range };
      if (header.meta) {
        const meta: { status: NonNullable<DngSegment["status"]>; anchor?: DngAnchor } = {
          status: header.meta.status ?? "ok",
        };
        if (header.meta.anchor) meta.anchor = header.meta.anchor;
        currentMeta = meta;
        expectingMetaLine = false;
      } else {
        currentMeta = null;
        expectingMetaLine = true;
      }
      continue;
    }

    if (expectingMetaLine) {
      // New format: metadata in an HTML comment line after the @@ header.
      const meta = parseSegmentMetaLine(line);
      if (meta) {
        const current: { status: NonNullable<DngSegment["status"]>; anchor?: DngAnchor } = {
          status: meta.status ?? "ok",
        };
        if (meta.anchor) current.anchor = meta.anchor;
        currentMeta = current;
        expectingMetaLine = false;
        continue;
      }

      // No meta line present. Treat the segment as "unsynced"; we can still render it,
      // and anchors can be (re)generated from sourceText when converting to a DngFile.
      currentMeta = { status: "missing" };
      expectingMetaLine = false;
      buf.push(line);
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
    out.push(formatSegmentHeaderLine(seg));
    out.push(formatSegmentMetaLine(seg));
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
