# Agent instructions (scope: packages/core/)

## Scope
- Applies to: `packages/core/` and subdirectories
- Languages/tooling: TypeScript (ESM), `tsup`, `vitest`, `eslint`, `prettier`

## Architecture (high-level)
- Style: clean (small library, minimal IO)
- Boundaries:
  - This package is pure logic: no filesystem access.
  - Keep public API in `src/index.ts`.
  - Changes to `.dng.json` schema must remain compatible or be versioned and documented.

## Commands
- Install: from repo root `npm install`
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
  "test": { "commands": ["npm run test"], "optional": false, "windows": [], "posix": [] },
  "rules": { "forbid_globs": [], "forbid_regex": [] }
}
```

