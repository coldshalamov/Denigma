import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ApiFileResponse, ApiFilesResponse, EditableSegment } from "./types";
import { connectGithubRepo, getDenigmaFile, listBranches, listDenigmaFiles, type GithubRepoState } from "./github";
import { downloadTextFile, exportFilenameForSourcePath, generateMarkdownExport } from "./export";
import { cycleIndex, findLineMatches, normalizeQuery } from "./search";
import { decodeViewerState, encodeViewerState, type UrlViewMode } from "./urlState";

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

type MarkdownProps = { markdown: string };

const Markdown = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
  ]);
  const Component = ({ markdown }: MarkdownProps) => <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>;
  return { default: Component };
});

type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

type ViewMode = "range" | "inline";
type StatusFilter = "all" | "attention" | "ok" | "missing" | "ambiguous";

function segmentStatus(s?: EditableSegment["status"]): "ok" | "missing" | "ambiguous" {
  if (s === "missing") return "missing";
  if (s === "ambiguous") return "ambiguous";
  return "ok";
}

export function App() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("main");
  const [baseDir, setBaseDir] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);

  const [repoState, setRepoState] = useState<Loadable<GithubRepoState>>({ status: "idle" });
  const [files, setFiles] = useState<Loadable<ApiFilesResponse>>({ status: "idle" });
  const [fileFilter, setFileFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [branchNames, setBranchNames] = useState<string[]>([]);

  const [activePath, setActivePath] = useState<string>("");
  const [activeFile, setActiveFile] = useState<Loadable<ApiFileResponse>>({ status: "idle" });
  const [activeSegmentId, setActiveSegmentId] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("range");

  const pendingSegmentRef = useRef<string>("");
  const [codeQuery, setCodeQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);

  const codeScrollerRef = useRef<HTMLDivElement | null>(null);

  const canConnect = owner.trim().length > 0 && repo.trim().length > 0;

  useEffect(() => {
    const initial = decodeViewerState(window.location.search);
    if (initial.owner) setOwner(initial.owner);
    if (initial.repo) setRepo(initial.repo);
    if (initial.ref) setRef(initial.ref);
    if (initial.baseDir) setBaseDir(initial.baseDir);
    if (initial.fileQuery) setFileFilter(initial.fileQuery);
    if (initial.status) setStatusFilter(initial.status);
    if (initial.path) setActivePath(initial.path);
    if (initial.mode) setViewMode(initial.mode as UrlViewMode);
    if (initial.segment) pendingSegmentRef.current = initial.segment;
  }, []);

  useEffect(() => {
    const search = encodeViewerState({
      ...(owner.trim() ? { owner } : {}),
      ...(repo.trim() ? { repo } : {}),
      ...(ref.trim() ? { ref } : {}),
      ...(baseDir.trim() ? { baseDir } : {}),
      ...(activePath ? { path: activePath } : {}),
      ...(activeSegmentId ? { segment: activeSegmentId } : {}),
      ...(viewMode !== "range" ? { mode: viewMode } : {}),
      ...(fileFilter.trim() ? { fileQuery: fileFilter } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, [owner, repo, ref, baseDir, activePath, activeSegmentId, viewMode, fileFilter, statusFilter]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function connect(): Promise<void> {
    setRepoState({ status: "loading" });
    setFiles({ status: "idle" });
    setActiveFile({ status: "idle" });
    try {
      const cfgBase = {
        owner: owner.trim(),
        repo: repo.trim(),
        ref: ref.trim() || "main",
      } as const;

      const cfg = baseDir.trim() ? { ...cfgBase, baseDir: baseDir.trim() } : cfgBase;
      const state = await connectGithubRepo(token.trim() ? { ...cfg, token: token.trim() } : cfg);
      setRepoState({ status: "ready", data: state });

      void listBranches(cfg.owner, cfg.repo, token.trim() ? token.trim() : undefined)
        .then((branches) => setBranchNames(branches))
        .catch(() => setBranchNames([]));

      setFiles({ status: "loading" });
      const list = await listDenigmaFiles(state);
      setFiles({ status: "ready", data: list });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setRepoState({ status: "error", message });
      setFiles({ status: "idle" });
    }
  }

  useEffect(() => {
    if (repoState.status !== "ready") return;
    if (!activePath) return;
    let cancelled = false;
    (async () => {
      setActiveFile({ status: "loading" });
      try {
        const data = await getDenigmaFile(repoState.data, activePath);
        if (cancelled) return;
        setActiveFile({ status: "ready", data });
        const pending = pendingSegmentRef.current;
        pendingSegmentRef.current = "";
        const selected = pending ? data.dng.segments.find((s) => s.id === pending) : undefined;
        const firstSeg = data.dng.segments[0];
        setActiveSegmentId(selected?.id ?? firstSeg?.id ?? "");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setActiveFile({ status: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repoState, activePath]);

  const segments = useMemo(() => {
    if (activeFile.status !== "ready") return [] as EditableSegment[];
    return activeFile.data.dng.segments;
  }, [activeFile]);

  const activeSegment = useMemo(() => segments.find((s) => s.id === activeSegmentId), [segments, activeSegmentId]);

  const codeLines = useMemo(() => {
    if (activeFile.status !== "ready") return [] as string[];
    return splitLines(activeFile.data.sourceText);
  }, [activeFile]);

  const lineMatches = useMemo(() => findLineMatches(codeLines, codeQuery), [codeLines, codeQuery]);
  const activeMatchLine = lineMatches.length > 0 ? (lineMatches[Math.max(0, matchIndex)] ?? -1) : -1;
  const lineMatchesSet = useMemo(() => new Set(lineMatches), [lineMatches]);

  useEffect(() => {
    setMatchIndex(lineMatches.length > 0 ? 0 : -1);
  }, [normalizeQuery(codeQuery), lineMatches.length]);

  const highlight = useMemo(() => {
    if (!activeSegment) return { start: -1, end: -1 };
    return { start: activeSegment.range.startLine, end: activeSegment.range.endLine };
  }, [activeSegment]);

  const filteredFiles = useMemo(() => {
    if (files.status !== "ready") return [];
    const q = fileFilter.trim().toLowerCase();
    const byText = q ? files.data.files.filter((f) => f.sourcePath.toLowerCase().includes(q)) : files.data.files;

    if (statusFilter === "all") return byText;
    return byText.filter((f) => {
      const { ok, missing, ambiguous } = f.segmentStatus;
      if (statusFilter === "ok") return missing === 0 && ambiguous === 0 && ok > 0;
      if (statusFilter === "missing") return missing > 0;
      if (statusFilter === "ambiguous") return ambiguous > 0;
      return missing + ambiguous > 0;
    });
  }, [files, fileFilter, statusFilter]);

  function selectSegmentForLine(lineNo: number): void {
    const seg = segments.find((s) => lineNo >= s.range.startLine && lineNo <= s.range.endLine);
    if (seg) setActiveSegmentId(seg.id);
  }

  function scrollToLine(lineNo: number): void {
    const scroller = codeScrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector(`[data-line="${lineNo}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ block: "center" });
    selectSegmentForLine(lineNo);
  }

  function jumpMatch(direction: 1 | -1): void {
    if (lineMatches.length === 0) return;
    const next = cycleIndex(matchIndex, lineMatches.length, direction);
    setMatchIndex(next);
    const lineNo = lineMatches[next];
    if (lineNo) scrollToLine(lineNo);
  }

  function exportMarkdown(): void {
    if (activeFile.status !== "ready") return;
    const md = generateMarkdownExport({
      sourcePath: activeFile.data.sourcePath,
      sourceText: activeFile.data.sourceText,
      dng: activeFile.data.dng,
    });
    downloadTextFile(exportFilenameForSourcePath(activeFile.data.sourcePath), md);
  }

  const inlineBlocksByStartLine = useMemo(() => {
    const map = new Map<number, EditableSegment[]>();
    for (const seg of segments) {
      const start = seg.range.startLine;
      const list = map.get(start) ?? [];
      list.push(seg);
      map.set(start, list);
    }
    return map;
  }, [segments]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <h1>Denigma Web</h1>
          <span className="muted">viewer for GitHub-hosted .denigma files</span>
        </div>
        <div className="topbarRight">
          <button
            className="toolBtn"
            type="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(window.location.href)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }
            disabled={!owner.trim() || !repo.trim()}
            title="Copy a shareable link to this view"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="hero">
        <div className="heroCard">
          <div className="heroTitle">Open a repository</div>
          <div className="heroGrid">
            <label className="field">
              <div className="fieldLabel">Owner</div>
              <input
                className="input"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="octocat"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConnect) void connect();
                }}
              />
            </label>
            <label className="field">
              <div className="fieldLabel">Repo</div>
              <input
                className="input"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="hello-world"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConnect) void connect();
                }}
              />
            </label>
            <label className="field">
              <div className="fieldLabel">Ref</div>
              <input
                className="input"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="main"
                list={branchNames.length > 0 ? "branches" : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConnect) void connect();
                }}
              />
              {branchNames.length > 0 ? (
                <datalist id="branches">
                  {branchNames.map((b) => (
                    <option value={b} key={b} />
                  ))}
                </datalist>
              ) : null}
            </label>
            <label className="field">
              <div className="fieldLabel">Repo folder (optional)</div>
              <input
                className="input"
                value={baseDir}
                onChange={(e) => setBaseDir(e.target.value)}
                placeholder="examples/demo-repo"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConnect) void connect();
                }}
              />
              <div className="fieldHint">Use this if `.denigma/` lives under a subfolder.</div>
            </label>
            <label className="field">
              <div className="fieldLabel">Token (optional)</div>
              <input
                className="input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="For private repos / higher rate limits"
                type="password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConnect) void connect();
                }}
              />
              <div className="fieldHint">Token is used only in your browser for GitHub API requests and is not stored.</div>
            </label>
          </div>

          <div className="heroActions">
            <button
              className="primaryBtn"
              onClick={() => void connect()}
              disabled={!canConnect || repoState.status === "loading"}
            >
              {repoState.status === "loading" ? "Connecting…" : "Connect"}
            </button>
            <button className="toolBtn" type="button" onClick={() => setToken("")} disabled={!token.trim()}>
              Clear token
            </button>
            <div className="muted">
              Read-only viewer: reads `.denigma/files/*.dng.json` via the GitHub API. Editing is disabled.
            </div>
          </div>

          {repoState.status === "error" ? <div className="notice">Connect failed: {repoState.message}</div> : null}
        </div>
      </div>

      <div className="layout">
        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">Files</div>
          </div>
          <div className="panelBody">
            <input
              className="input"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              placeholder="Filter files…"
              aria-label="Filter files"
              disabled={files.status !== "ready"}
            />
            <div className="spacer8" />
            <div className="filterRow" aria-label="File status filter">
              {(["all", "attention", "missing", "ambiguous", "ok"] satisfies StatusFilter[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip ${statusFilter === k ? "chipActive" : ""}`}
                  onClick={() => setStatusFilter(k)}
                  disabled={files.status !== "ready"}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="spacer8" />
            {files.status === "idle" && <div className="muted">Connect a repo to list files.</div>}
            {files.status === "loading" && <div className="muted">Loading…</div>}
            {files.status === "error" && <div>Failed: {files.message}</div>}
            {files.status === "ready" && (
              <div className="filesList">
                {(filteredFiles satisfies ApiFilesResponse["files"]).map((file) => {
                  const active = file.sourcePath === activePath;
                  const missing = file.segmentStatus.missing + file.segmentStatus.ambiguous;
                  return (
                    <button
                      key={file.sourcePath}
                      className={`fileItem ${active ? "fileItemActive" : ""}`}
                      onClick={() => setActivePath(file.sourcePath)}
                      type="button"
                    >
                      <div className="fileRow">
                        <div className="filePath">{file.sourcePath}</div>
                        {missing > 0 ? (
                          <span className="pill pillWarn" title="Some segments are missing or ambiguous">
                            attention
                          </span>
                        ) : (
                          <span className="pill pillOk" title="All segments are anchored">
                            ok
                          </span>
                        )}
                      </div>
                      <small>
                        ok {file.segmentStatus.ok} · missing {file.segmentStatus.missing} · ambiguous{" "}
                        {file.segmentStatus.ambiguous}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">Explanation</div>
            <button className="toolBtn" onClick={() => exportMarkdown()} disabled={activeFile.status !== "ready"}>
              Export
            </button>
          </div>
          <div className="panelBody">
            {activeFile.status !== "ready" && <div className="muted">Select a file to view its semantic sidecar.</div>}
            {activeFile.status === "error" && <div>Failed: {activeFile.message}</div>}
            {activeFile.status === "ready" && (
              <div className="editor">
                <div className="segments">
                  {segments.map((segment) => {
                    const active = segment.id === activeSegmentId;
                    const status = segmentStatus(segment.status);
                    return (
                      <button
                        key={segment.id}
                        className={`segmentBtn ${active ? "segmentBtnActive" : ""}`}
                        onClick={() => setActiveSegmentId(segment.id)}
                        type="button"
                      >
                        <div className="segmentRow">
                          <div className="segmentTitle">
                            <strong>{segment.id}</strong>{" "}
                            <span className="segmentMeta">
                              L{segment.range.startLine}–L{segment.range.endLine}
                            </span>
                          </div>
                          <span
                            className={`pill ${
                              status === "ok" ? "pillOk" : status === "missing" ? "pillDanger" : "pillWarn"
                            }`}
                            title={`Status: ${status}`}
                          >
                            {status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="markdown markdownPanel" role="tabpanel">
                  <Suspense fallback={<div className="muted">Loading…</div>}>
                    <Markdown markdown={activeSegment?.markdown || "*No text.*"} />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">Code</div>
            <div className="panelHeaderRight">
              <div className="searchWrap">
                <input
                  className="input inputSmall"
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search code"
                  disabled={activeFile.status !== "ready"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") jumpMatch(e.shiftKey ? -1 : 1);
                    if (e.key === "Escape") setCodeQuery("");
                  }}
                />
                <div className="searchMeta" aria-label="Search results">
                  {lineMatches.length > 0 ? `${Math.max(1, matchIndex + 1)}/${lineMatches.length}` : "0/0"}
                </div>
              </div>
              <button className="toolBtn toolBtnSmall" onClick={() => jumpMatch(-1)} disabled={lineMatches.length === 0}>
                Prev
              </button>
              <button className="toolBtn toolBtnSmall" onClick={() => jumpMatch(1)} disabled={lineMatches.length === 0}>
                Next
              </button>
              <button
                className={`toolBtn ${viewMode === "range" ? "toolBtnActive" : ""}`}
                onClick={() => setViewMode("range")}
                type="button"
                disabled={activeFile.status !== "ready"}
              >
                Range
              </button>
              <button
                className={`toolBtn ${viewMode === "inline" ? "toolBtnActive" : ""}`}
                onClick={() => setViewMode("inline")}
                type="button"
                disabled={activeFile.status !== "ready"}
              >
                Inline
              </button>
            </div>
          </div>
          <div className="panelBody codeBody" ref={codeScrollerRef}>
            {activeFile.status !== "ready" && <div className="muted">Select a file.</div>}
            {activeFile.status === "ready" && (
              <div>
                {codeLines.map((line, idx) => {
                  const lineNo = idx + 1;
                  const inRange = lineNo >= highlight.start && lineNo <= highlight.end;
                  const startSegs = viewMode === "inline" ? (inlineBlocksByStartLine.get(lineNo) ?? []) : [];

                  return (
                    <div key={idx}>
                      {startSegs.length > 0 && (
                        <div className="inlineExplain">
                          {startSegs.map((seg) => {
                            const status = segmentStatus(seg.status);
                            const open = seg.id === activeSegmentId;
                            return (
                              <details key={seg.id} open={open}>
                                <summary
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setActiveSegmentId(seg.id);
                                  }}
                                >
                                  <span className="inlineExplainTitle">
                                    <strong>{seg.id}</strong>{" "}
                                    <span className="muted">
                                      L{seg.range.startLine}–L{seg.range.endLine}
                                    </span>
                                  </span>
                                  <span
                                    className={`pill ${
                                      status === "ok"
                                        ? "pillOk"
                                        : status === "missing"
                                          ? "pillDanger"
                                          : "pillWarn"
                                    }`}
                                  >
                                    {status}
                                  </span>
                                </summary>
                                <div className="markdown inlineExplainBody">
                                  <Suspense fallback={<div className="muted">Loading…</div>}>
                                    <Markdown markdown={seg.markdown} />
                                  </Suspense>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      )}

                      <div
                        data-line={lineNo}
                        className={`codeLine ${
                          inRange ? "codeLineHighlight" : ""
                        } ${lineMatchesSet.has(lineNo) ? "codeLineMatch" : ""} ${
                          activeMatchLine === lineNo ? "codeLineMatchActive" : ""
                        }`}
                        onClick={() => selectSegmentForLine(lineNo)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") selectSegmentForLine(lineNo);
                        }}
                      >
                        <div className="codeLineNum">{lineNo}</div>
                        <div>{line}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
