# Denigma

Denigma is a developer tool that keeps a *separate*, extremely-verbose, plain-English "semantic codebase" in sync with a real codebase.

Instead of in-code comments, Denigma stores explanations in `.dng` sidecar files that are line-anchored to the source, survive edits, and can be viewed side-by-side in a local UI.

## Quickstart (developer)

From `D:/GitHub/Denigma`:

1) Install deps + build:
   - `npm install`
   - `npm run build`
2) Initialize + track a file in a target repo:
   - `node packages/cli/dist/bin.cjs init --dir <repoRoot>`
   - `node packages/cli/dist/bin.cjs track <repoRelativeFile> --dir <repoRoot>`
   - Optional: `node packages/cli/dist/bin.cjs status --dir <repoRoot>`
3) Run the app (2 terminals):
   - Terminal A (API): `node packages/cli/dist/bin.cjs serve --dir <repoRoot> --port 8787`
   - Terminal B (UI): `npm -w @denigma/ui dev`
   - Open `http://localhost:5173`

## Web + Desktop

- **Web (GitHub viewer):** `npm -w @denigma/web dev` then open `http://localhost:5174`
  - Supports shareable links (repo/ref/file/segment/mode) and file status filters.
- **Desktop (Electron):**
  - Build UI first: `npm -w @denigma/ui run build`
  - Run: `npm -w @denigma/desktop run build` then `node packages/desktop/dist/main.cjs`
  - Dev (uses UI dev server): `npm -w @denigma/desktop run dev`
  - Includes menu actions for revealing the repo folder and copying the local app URL.

## CLI commands

- `status` - list tracked files + segment health
- `doctor` - validate `.denigma/files` and detect stale sidecars
- `sync` / `sync-all` - re-anchor segment ranges after source edits
- `import-comments` - migrate comment-only lines into `.dng.json` markdown (source unchanged)
- `strip-comments` - import comment-only lines, then remove them from the source file

## UI notes

- Click a code line to select the segment that covers it.
- Use **Range** vs **Inline** to switch between a classic split view and an "inline comments" view.
- Use **Sync** to re-anchor segment ranges after the source file has changed (same behavior as `denigma sync`).
- Use **Export** to download a Markdown study guide for the current file.
- Use the **Search** box in the Code panel to jump through matching lines.

## File format

Denigma stores file explanations under `.denigma/files/*.dng.json`. Each segment has:
- A `range` (line-anchored) and an `anchor` (context-based) used to remap after edits
- A `markdown` field containing the plain-English explanation

More details: `docs/file-format.md`.

## Status

Work in progress.

## Docs

- `docs/USER_INSTRUCTIONS_FULL.md` - consolidated product and process requirements
- `docs/ADVERSARIAL_SWARM_REVIEW.md` - multi-perspective review + synthesis

