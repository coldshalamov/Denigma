# Agent instructions (scope: packages/server/)

## Scope
- Applies to: `packages/server/` and subdirectories
- Languages/tooling: TypeScript (ESM), Express, `tsup`, `vitest`, `eslint`, `prettier`

## Architecture (high-level)
- Style: layered (HTTP -> validation -> repo IO -> core)
- Boundaries:
  - Treat query params and request bodies as untrusted; validate with `zod`.
  - Never allow reading/writing outside `repoRoot`.
  - Keep API shape stable; UI depends on it.

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

