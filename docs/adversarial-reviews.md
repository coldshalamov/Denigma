# Adversarial reviews (5 personas) + synthesis

This document simulates “fresh subagent” reviews as separate personas. In this environment, I can’t literally run five independent agent processes, but I can produce independent review passes with different priorities and then reconcile them.

## Persona 1 — Security engineer (paranoid-by-default)

**What’s good**
- Path handling is generally defensive (repo-relative normalization in CLI; server rejects absolute paths).
- Server now rejects saving a `.dng.json` whose `dng.sourcePath` doesn’t match the query `path` (prevents foot-guns and keeps the API coherent).

**Concerns**
- **Server CORS is wide open**: for a local-only tool this is usually fine, but it means any site can hit the API if the user’s browser can reach `localhost:8787`.
- Markdown preview renders user-provided text. It’s currently safe because `react-markdown` does **not** render raw HTML without a plugin, but that’s a “future hazard” if someone adds `rehypeRaw`.

**Recommendations**
- Consider optional “local-only hardening” mode:
  - Bind server to `127.0.0.1` explicitly (not `0.0.0.0`)
  - Add a random per-session token required by the UI (simple shared secret)
  - Restrict CORS to the UI origin when running in dev mode

## Persona 2 — Performance engineer (big-repo pessimist)

**What’s good**
- UI uses `content-visibility: auto` on code lines to reduce rendering work.
- Search highlights are Set-based and computed once per query.

**Concerns**
- Rendering every line in React can still be slow for very large files (tens of thousands of lines).
- `react-markdown` preview can become heavy on huge segments.

**Recommendations**
- Add viewport virtualization for the Code panel (e.g., `react-window`).
- Add a “collapsed segments by default” option for inline mode on very large files.
- Consider a server endpoint to stream code slices by range for giant files.

## Persona 3 — DX engineer (CLI-first pragmatist)

**What’s good**
- `status` / `sync-all` enables CI-like workflows and “repo health” at a glance.
- `strip-comments` supports the core thesis: keep code clean, keep explanation verbose.

**Concerns**
- CLI UX is still “developer internal” (node path to dist). People want `denigma` installed globally or per-project.
- Some commands could benefit from structured output for scripting.

**Recommendations**
- Add `--json` to `status` (already present) and extend `sync-all` with `--json`.
- Add `denigma init` to write a minimal `.denigma/denigma.json` plus a `.denigma/.gitignore` helper for target repos.
- Add `track-glob` to mass-track files (with ignore patterns).

## Persona 4 — Staff engineer (architecture + correctness)

**What’s good**
- Anchor remapping now tolerates indentation changes and ignores empty/comment-only context lines.
- Tests cover the most failure-prone boundary: “source changes but sidecar should survive.”

**Concerns**
- Current remapping strategy still depends on `start`/`end` exact line matches (with a fallback trim). That’s good (low ambiguity), but breaks when the exact start/end lines change.
- Segment scanning is still heuristic; it can miss common patterns (arrow functions, etc.).

**Recommendations**
- Add optional “fuzzy” remap mode:
  - if exact start/end can’t be found, fall back to start-only or similarity scoring within a window
  - but surface ambiguity clearly (don’t silently guess)
- Improve segment scanning patterns or offer a plugin system per language.

## Persona 5 — Product + education (teaching mission)

**What’s good**
- Inline mode + export Markdown creates a “study guide” workflow for juniors/vibe-coders.
- Search + jump supports “read the code like a textbook.”

**Concerns**
- The tool still requires users to author explanations manually; that’s correct philosophically, but onboarding needs more scaffolding.
- People will ask for “diff-based understanding” (what changed, why it changed).

**Recommendations**
- Add “learning mode” UI:
  - checklist per segment (understood / uncertain)
  - quiz prompts (“What does this function return for X?”)
- Add a “commit diff view” that shows which segments became missing/ambiguous after changes.

---

## Synthesis (what “perfect” looks like)

All personas agree Denigma’s value hinges on two things:

1) **Anchors must survive real-world edits** without silently drifting.
2) **The UI must scale** to big files and provide a “reading experience” that feels like studying a great textbook.

### Decisions made in this iteration
- Keep remapping conservative (avoid fuzzy matching that can lie).
- Improve resilience to common, low-risk transforms (indentation + comment motion).
- Add workflow accelerators: `status`, `sync-all`, comment migration, search, export.

### Proposed next iteration (5 additional “big wins”)
1. **Virtualized code rendering** for huge files (react-window).
2. **Track-by-glob** in CLI to bootstrap large repos fast.
3. **Local-only hardening**: optional token + restricted CORS.
4. **Segment scan upgrades** (arrow functions, exports, common class patterns).
5. **Repo health dashboard**: show missing/ambiguous segments as a prioritized task list.

