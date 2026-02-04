# Agent instructions (scope: packages/ui/)

## Scope
- Applies to: `packages/ui/` and subdirectories
- Languages/tooling: TypeScript (ESM), React, Vite, `eslint`, `prettier`, `vitest`

## Architecture (high-level)
- Style: component-driven (single-page UI)
- Boundaries:
  - UI is a local viewer/editor for a repo; keep network calls in a small API helper when adding more endpoints.
  - Do not assume small files: keep scrollable regions and avoid work that scales linearly when possible.
  - Keep interactions keyboard-accessible and ensure visible focus states.

## Commands
- Install: from repo root `npm install`
- Dev: `npm run dev`
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

