# Agent instructions (scope: packages/web/)

## Scope
- Applies to: `packages/web/` and subdirectories
- Languages/tooling: TypeScript (ESM), React, Vite, `eslint`, `prettier`, `vitest`

## Architecture (high-level)
- Style: component-driven, read-only GitHub viewer
- Boundaries:
  - This app should remain read-only unless/until a safe GitHub commit flow is added.
  - Treat GitHub responses as untrusted; validate JSON parsing errors and show friendly UI errors.
  - Avoid adding `rehypeRaw` unless you explicitly sanitize Markdown.

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

