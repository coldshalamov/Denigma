# User Instructions (Captured 2026-02-04)

This document consolidates the instructions and desired outcomes you described for Denigma, so future work can be evaluated against a stable checklist.

## Product Vision (What Denigma should be)

- Treat in-code comments as low value for LLMs (token cost, often redundant).
- Move “explanation” into a **sidecar, plain-text-first** format that can be extremely verbose without bloating source files.
- Provide a **side-by-side** reading experience:
  - **Code on the right**
  - **Explanation on the left**
  - Explanation references code by **line number**, with explanation blocks that may span multiple lines while mapping to a single code line or code-range.
- Make the explanation layer **diff-friendly** and “Git-like” (reviewable and trackable alongside code changes).
- Make it useful for:
  - “Vibe coders” learning what their program does
  - Junior developers building real understanding
  - Senior developers assigning “homework” to learn unfamiliar codebases

## Explicit Deliverables You Requested

- A “Git-like” sidecar record system for verbose explanations (separate files, not embedded comments).
- Two viewing modes:
  1) **Split view** (code vs explanation)
  2) **Unified overlay view** (appears like comments inline, but generated from sidecar)
- A **desktop app** (Electron) that runs locally on top of the protocol.
- A **website** that can open a GitHub repository containing Denigma files and show the explanation side-by-side with code.
- Improve the interface using a strong UI/UX approach (you explicitly requested using UI/UX skill guidance).

## “Process” Instructions You Requested (How to execute)

You asked for extremely deep and iterative work, including:
- “Handle everything” end-to-end.
- Review “line by line at least 10 times”, use “every skill”, and find anything to improve.
- Add **5 features**, test, and iterate multiple times.
- After that, run a systematic debugging pass “to make sure it’s perfect”.
- Dispatch “5 subagents” with different perspectives/personas to argue over quality and synthesize a final result.
- “Only stop when all steps are complete” plus “5 more things you can think of”.

## How These Instructions Were Implemented (Interpretation + Boundaries)

Some instructions were literal deliverables (desktop app + GitHub web viewer), and some were “quality bar / intensity” instructions. The implementation approach used:

- Multiple verification passes: `typecheck`, `test`, `lint`, and `build` across all workspaces, repeated as changes landed.
- A systematic-debugging style approach whenever failures occurred: reproduce → isolate root cause → fix → re-run verification.
- “Subagent” perspective simulation as an adversarial review document, since actual multi-agent execution isn’t available in this environment.

## Completion Checklist (Repository State)

### Core product (sidecar explanation)
- [x] Sidecar format + parsing (`@denigma/core`)
- [x] Anchor/remap logic tolerates comment-only context changes (more resilient range remapping)

### Local app experience
- [x] Local server API for viewing/editing `.dng.json`
- [x] Local UI side-by-side viewer/editor
- [x] Desktop app wrapper (Electron) that starts the local server and loads the UI

### GitHub web viewer
- [x] Web app that can open a GitHub repo (read-only) and render `.denigma/files/*.dng.json` alongside code
- [x] Shareable deep links (URL state for repo/ref/path/segment/mode)
- [x] Branch name suggestions (branch list → datalist)
- [x] File list status filtering (ok/missing/ambiguous/attention)
- [x] API caching + improved GitHub error reporting (rate limit hints)

### Quality and iteration
- [x] Tests added for core hashing, web URL state, GitHub integration behavior
- [x] Repo-wide `typecheck`, `test`, `lint`, and `build` passing
- [x] Performance improvement: web viewer Markdown rendering is lazily loaded (code-split)

## Known Limitations / Future Enhancements

- Denigma Web is **read-only** (no safe “commit back to GitHub” flow yet).
- Very large repos can hit GitHub API limitations (recursive tree truncation, rate limits).
- For huge source files, the UI could benefit from virtualization (render windowing) to keep scroll smooth.

## Related Docs

- `docs/USER_REQUEST.md` (earlier captured prompt context)
- `docs/UI_UX_DESIGN_SYSTEM.md` (design guidance already captured)
- `docs/adversarial-reviews.md` and `docs/ADVERSARIAL_SWARM_REVIEW.md` (persona-based review + synthesis)

