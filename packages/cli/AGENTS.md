# Agent instructions (scope: packages/cli/)

## Scope
- Applies to: `packages/cli/` and subdirectories
- Languages/tooling: TypeScript (ESM), `tsup`, `vitest`, `eslint`, `prettier`

## Architecture (high-level)
- Style: layered (commands -> repo IO -> core)
- Boundaries:
  - Keep CLI wiring in `src/cli.ts`; keep IO helpers in `src/*.ts`.
  - Reject path traversal and absolute paths for any repo-relative inputs.
  - Prefer using `@denigma/core` for schema/remapping rather than duplicating logic.

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

