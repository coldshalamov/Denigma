# Denigma `.dng.json` file format (v1)

Denigma uses a sidecar file format intended to:
- Keep verbose natural-language explanations *out of source files* (no token tax in comments)
- Stay stable across edits by re-anchoring segments using context

## Location

For a repo with Denigma initialized, `.dng` files live in:

`<repoRoot>/.denigma/files/*.dng.json`

## Structure (high level)

```json
{
  "schemaVersion": 1,
  "sourcePath": "src/example.ts",
  "sourceSha256": "…",
  "createdAt": "2026-01-29T…Z",
  "updatedAt": "2026-01-29T…Z",
  "segments": [
    {
      "id": "seg-1",
      "range": { "startLine": 10, "startCol": 0, "endLine": 42, "endCol": 0 },
      "anchor": {
        "before": ["…"],
        "start": "function foo() {",
        "end": "}",
        "after": ["…"]
      },
      "markdown": "Plain-English explanation…",
      "status": "ok"
    }
  ]
}
```

## Remapping model

`range` is the last-known line range in the *current* version of the file.

`anchor` stores “context” around the segment:
- `before`: N lines immediately above the segment start
- `start`: the start line
- `end`: the end line
- `after`: N lines immediately below the segment end

When the file changes, Denigma:
1) Searches for candidate `start` lines.
2) Filters candidates by matching `before`.
3) Finds an `end` line at/after the candidate start.
4) Filters by matching `after`.

Implementation note: Denigma first attempts an exact line match. If it finds no matches, it retries using a whitespace-trimmed comparison to tolerate indentation changes. During matching, “context” lines that are empty or comment-only are treated as ignorable, so deleting/moving comments is less likely to break anchoring.

If it finds:
- 0 matches → `status: "missing"`
- >1 matches → `status: "ambiguous"`
- exactly 1 match → updates `range` and sets `status: "ok"`
