# Agent instructions (scope: this directory and subdirectories)

## Scope and layout
- **This AGENTS.md applies to:** `./` and below.
- **Key directories:**
  - `packages/core/`: sidecar file format + remapping logic (library)
  - `packages/cli/`: `denigma` CLI (init/track/sync/serve)
  - `packages/server/`: local API that serves code + `.dng.json` and persists edits
  - `packages/ui/`: local web UI (Vite + React)
  - `docs/`: file format + design notes
  - `.denigma/`: runtime storage used when Denigma is run against a target repo (ignored by git in this repo)

## Modules / subprojects

| Module | Type | Path | What it owns | How to run | Tests | Docs | AGENTS |
|--------|------|------|--------------|------------|-------|------|--------|
| core | library (ts) | `packages/core/` | `.dng.json` schema + anchor/remap | built via workspace build | `npm test` | `docs/file-format.md` | `packages/core/AGENTS.md` |
| cli | node cli (ts) | `packages/cli/` | `denigma` commands + repo IO | build then run `node dist/bin.cjs …` | `npm test` | `README.md` | `packages/cli/AGENTS.md` |
| server | express (ts) | `packages/server/` | `/api/*` endpoints | via CLI `denigma serve` | `npm test` | `README.md` | `packages/server/AGENTS.md` |
| ui | vite+react (ts) | `packages/ui/` | side-by-side viewer/editor | `npm -w @denigma/ui dev` | `npm test` | `README.md` | `packages/ui/AGENTS.md` |
| web | vite+react (ts) | `packages/web/` | GitHub-backed read-only viewer | `npm -w @denigma/web dev` | `npm test` | `README.md` | `packages/web/AGENTS.md` |
| desktop | electron (ts) | `packages/desktop/` | local desktop wrapper | `npm -w @denigma/desktop dev` | `npm test` | `README.md` | `packages/desktop/AGENTS.md` |

## Cross-domain workflows
- **Track/sync pipeline:** CLI reads source -> `@denigma/core` creates anchors -> writes `.denigma/files/<encoded>.dng.json` in the target repo.
- **UI editing:** UI calls `@denigma/server` `/api/file` to load `sourceText + dng`, edits segment `markdown`, and saves back via `PUT /api/file`.
- **Remapping after edits:** `.dng.json` segments are re-anchored via `@denigma/core` remap logic (CLI; server exposes `POST /api/sync` for the UI).

## Verification (preferred commands)
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run typecheck`

## Global conventions
- Keep source files mostly free of explanatory comments; prefer `.dng.json` content and docs for verbose explanation.
- Treat all repo-relative paths as untrusted input: normalize and reject traversal (`..`), absolute paths, and NUL.
- Keep `.dng.json` changes backward-compatible where practical; if schema changes, document it in `docs/`.

## Links to module instructions
- `packages/core/AGENTS.md`
- `packages/cli/AGENTS.md`
- `packages/server/AGENTS.md`
- `packages/ui/AGENTS.md`
- `packages/web/AGENTS.md`
- `packages/desktop/AGENTS.md`
