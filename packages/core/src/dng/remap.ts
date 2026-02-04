import {
  DEFAULT_ANCHOR_CONFIG,
  type AnchorConfig,
  createAnchorForRange,
  remapRangeByAnchor,
} from "./anchors.js";
import type { DngFile, DngRange, DngSegment } from "./schema.js";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export type SegmentInput = {
  id: string;
  range: DngRange;
  markdown: string;
};

export type CreateDngFileInput = {
  sourcePath: string;
  sourceText: string;
  anchorConfig?: AnchorConfig;
  segments: SegmentInput[];
};

const sha256Encoder = new TextEncoder();

export function sha256Hex(text: string): string {
  return bytesToHex(sha256(sha256Encoder.encode(text)));
}

export function createDngFile(input: CreateDngFileInput): DngFile {
  const now = new Date().toISOString();
  const sourceSha256 = sha256Hex(input.sourceText);
  const anchorConfig = input.anchorConfig ?? DEFAULT_ANCHOR_CONFIG;

  const segments: DngSegment[] = input.segments.map((segment) => ({
    id: segment.id,
    range: segment.range,
    anchor: createAnchorForRange(input.sourceText, segment.range, anchorConfig),
    markdown: segment.markdown,
    status: "ok",
  }));

  return {
    schemaVersion: 1,
    sourcePath: input.sourcePath,
    sourceSha256,
    createdAt: now,
    updatedAt: now,
    segments,
  };
}

export function remapDngFileToText(existing: DngFile, newText: string): DngFile {
  const now = new Date().toISOString();
  const sourceSha256 = sha256Hex(newText);

  const segments: DngSegment[] = existing.segments.map((segment) => {
    const remap = remapRangeByAnchor(newText, segment.anchor);
    if (remap.ok) {
      return { ...segment, range: remap.range, status: "ok" };
    }
    return {
      ...segment,
      status: remap.reason === "not-found" ? "missing" : "ambiguous",
    };
  });

  return {
    ...existing,
    sourceSha256,
    updatedAt: now,
    segments,
  };
}
