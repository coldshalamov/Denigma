import { z } from "zod";

export const DngRangeSchema = z.object({
  startLine: z.number().int().positive(),
  startCol: z.number().int().nonnegative(),
  endLine: z.number().int().positive(),
  endCol: z.number().int().nonnegative(),
});

export type DngRange = z.infer<typeof DngRangeSchema>;

export const DngSegmentSchema = z.object({
  id: z.string().min(1),
  range: DngRangeSchema,
  anchor: z
    .object({
      before: z.array(z.string()),
      start: z.string(),
      end: z.string(),
      after: z.array(z.string()),
    })
    .strict(),
  markdown: z.string(),
  status: z.enum(["ok", "missing", "ambiguous"]).optional(),
});

export type DngSegment = z.infer<typeof DngSegmentSchema>;

export const DngFileSchema = z.object({
  schemaVersion: z.literal(1),
  sourcePath: z.string().min(1),
  sourceSha256: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  segments: z.array(DngSegmentSchema),
});

export type DngFile = z.infer<typeof DngFileSchema>;

export function parseDngFile(input: unknown): DngFile {
  return DngFileSchema.parse(input);
}
