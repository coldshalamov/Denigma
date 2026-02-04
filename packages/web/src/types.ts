import type { DngFile, DngSegment } from "@denigma/core";

export type ApiFilesResponse = {
  files: Array<{
    sourcePath: string;
    updatedAt: string;
    segmentStatus: { ok: number; missing: number; ambiguous: number };
  }>;
};

export type ApiFileResponse = {
  sourcePath: string;
  sourceText: string;
  dng: DngFile;
};

export type EditableSegment = DngSegment;

