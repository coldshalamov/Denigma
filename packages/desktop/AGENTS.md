# Agent instructions (scope: packages/desktop/)

## Scope
- Applies to: `packages/desktop/` and subdirectories
- Languages/tooling: TypeScript (Node/Electron), `tsup`, Electron

## Architecture (high-level)
- Style: thin Electron shell over the existing local protocol
- Boundaries:
  - Keep Electron privileged code in the main process only.
  - Renderer should not get filesystem access (keep `nodeIntegration: false`).
  - Prefer `@denigma/server` for API + static UI hosting; do not duplicate server logic in Electron.

## Commands
- Install: from repo root `npm install`
- Dev: `npm run dev` (starts UI dev server + Electron)
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm run test`
- Typecheck: `npm run typecheck`

## Verifiable config (used by `coding-guidelines-verify`)
```codex-guidelines
{
  "version": 1,
  "format": {
    "autofix": true,
    "commands": ["npx prettier -w ."],
    "windows": [],
    "posix": []
  },
  "lint": { "commands": ["npm run lint"], "windows": [], "posix": [] },
  "test": { "commands": ["npm run test"], "optional": true, "windows": [], "posix": [] },
  "rules": { "forbid_globs": [], "forbid_regex": [] }
}
```

