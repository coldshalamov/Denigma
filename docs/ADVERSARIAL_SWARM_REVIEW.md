# Adversarial Swarm Review (2026-02-04)

Goal: approximate the “5 subagents with different perspectives arguing, then synthesize” workflow by forcing disagreement across priorities and then converging on a concrete next-step backlog.

## Persona A — Security / Privacy Engineer

**Primary concerns**
- GitHub token handling: never leak tokens into URLs, logs, exports, or crash traces.
- Treat all GitHub responses as untrusted; avoid raw HTML rendering in Markdown.
- Desktop app privileges: keep filesystem access in main process only.

**Praise**
- Token is not embedded in URL state.
- Markdown rendering uses `react-markdown` + `remark-gfm` (no `rehypeRaw`), which avoids raw HTML injection by default.
- Electron keeps `nodeIntegration: false` and `contextIsolation: true`.

**Critiques / asks**
- Add explicit “token is never stored” helper text, and a “clear token” button.
- Add a hardened error surface: differentiate “rate limited” vs “not found” vs “auth required”.

## Persona B — Performance Engineer

**Primary concerns**
- Reduce bundle cost and parse time; keep interaction snappy.
- Avoid repeated GitHub API calls (rate-limits + latency).
- Keep scroll performance stable for large files.

**Praise**
- GitHub blob cache added for repeated reads.
- Web viewer now lazy-loads Markdown rendering, producing smaller initial chunks.
- Code panel uses `content-visibility` to improve large-file rendering behavior.

**Critiques / asks**
- Add optional virtualization for very large files (>5k lines).
- Batch GitHub blob requests where possible (GitHub API doesn’t truly batch blobs, but you can reduce round-trips by reusing tree and caching aggressively).

## Persona C — DX (Developer Experience) Lead

**Primary concerns**
- Smooth onboarding: “how do I use this in my repo?” should be obvious.
- Consistent commands and predictable outputs.
- Build/test/lint should be one-liners from repo root.

**Praise**
- Monorepo workspaces are wired with consistent `typecheck`, `test`, `lint`, `build`.
- Web + Desktop packages integrate into workspace scripts.

**Critiques / asks**
- Add a single “getting started” flow in README that covers:
  - local mode (CLI/server/UI)
  - desktop mode
  - GitHub web viewer limitations
- Add a “doctor” command to validate `.denigma` integrity in a target repo.

## Persona D — UX Researcher

**Primary concerns**
- Discoverability: users should immediately understand what to do next.
- The split-view reading experience must feel stable and learnable.
- Shareability: links should reliably restore view state.

**Praise**
- Shareable link flow exists and provides instant feedback (“Copied”).
- File list status signals and filters help triage “what needs attention”.
- Branch suggestions improve “ref” discoverability without adding complex UI.

**Critiques / asks**
- Add an explicit empty state illustration / microcopy showing “select a file → click a code line → see explanation”.
- Add a persistent “mode” indicator and a one-line “what changes in inline mode” hint.

## Persona E — Maintainer / Future-Proofing

**Primary concerns**
- Keep the protocol stable; avoid frequent schema churn.
- Avoid brittle coupling between web viewer and core internals.
- Ensure fixes are validated by automated checks.

**Praise**
- Browser compatibility fix in core hashing removes Node-only dependency from the critical path for web builds.
- Added hash vector tests to prevent silent regressions.

**Critiques / asks**
- Add a small compatibility note: the `sourceSha256` field is for change detection; keep stable.
- Keep “read-only GitHub viewer” as a hard boundary until a safe write-back model exists.

---

## Synthesis (What “perfect” means next)

All personas agree the current state is strong for a first “real” product surface. The next “best possible” improvements converge on:

1) **Safety clarity**
   - Add explicit UX cues about token handling and security boundaries.
2) **Scale handling**
   - Add virtualization for very large files to keep UI responsive.
3) **Onboarding excellence**
   - Add a single “start here” guide and a “doctor” command to validate sidecars.
4) **Better diagnostics**
   - Improve error classification and recovery affordances (rate limit / auth / missing file).
5) **Protocol stability**
   - Avoid breaking changes; document any required schema/version evolution.

