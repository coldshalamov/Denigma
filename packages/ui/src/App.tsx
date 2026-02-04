import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ApiFileResponse, ApiFilesResponse, EditableSegment } from "./types";
import {
  downloadTextFile,
  exportFilenameForSourcePath,
  generateMarkdownExport,
  sidecarFilenameForSourcePath,
} from "./export";
import { cycleIndex, findLineMatches, normalizeQuery } from "./search";

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
type EditorTab = "edit" | "preview";
type StatusFilter = "all" | "attention" | "ok" | "missing" | "ambiguous";

function segmentStatus(s?: EditableSegment["status"]): "ok" | "missing" | "ambiguous" {
  if (s === "missing") return "missing";
  if (s === "ambiguous") return "ambiguous";
  return "ok";
}

export function App() {
  const [files, setFiles] = useState<Loadable<ApiFilesResponse>>({ status: "idle" });
  const [fileFilter, setFileFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activePath, setActivePath] = useState<string>("");
  const [activeFile, setActiveFile] = useState<Loadable<ApiFileResponse>>({ status: "idle" });
  const [activeSegmentId, setActiveSegmentId] = useState<string>("");
  const [draftMarkdown, setDraftMarkdown] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("range");
  const [editorTab, setEditorTab] = useState<EditorTab>("edit");
  const [notice, setNotice] = useState<string>("");
  const [store, setStore] = useState<"dng" | "denigma">("denigma");
  const [codeQuery, setCodeQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);

  const codeScrollerRef = useRef<HTMLDivElement | null>(null);

  async function refreshFiles(): Promise<void> {
    setFiles({ status: "loading" });
    const res = await fetch("/api/files");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ApiFilesResponse;
    setFiles({ status: "ready", data });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshFiles();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setFiles({ status: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/meta");
        if (!res.ok) return;
        const data = (await res.json()) as { store?: "dng" | "denigma" };
        if (!cancelled && (data.store === "dng" || data.store === "denigma")) setStore(data.store);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activePath) return;
    let cancelled = false;
    (async () => {
      setActiveFile({ status: "loading" });
      try {
        const res = await fetch(`/api/file?path=${encodeURIComponent(activePath)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ApiFileResponse;
        if (cancelled) return;
        setActiveFile({ status: "ready", data });
        const firstSeg = data.dng.segments[0];
        setActiveSegmentId(firstSeg?.id ?? "");
        setDraftMarkdown(firstSeg?.markdown ?? "");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setActiveFile({ status: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  const segments = useMemo(() => {
    if (activeFile.status !== "ready") return [] as EditableSegment[];
    return activeFile.data.dng.segments;
  }, [activeFile]);

  const activeSegment = useMemo(() => {
    return segments.find((s) => s.id === activeSegmentId);
  }, [segments, activeSegmentId]);

  useEffect(() => {
    setDraftMarkdown(activeSegment?.markdown ?? "");
    setEditorTab("edit");
  }, [activeSegment?.id]);

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
    if (!q) return files.data.files;
    return files.data.files.filter((f) => f.sourcePath.toLowerCase().includes(q));
  }, [files, fileFilter]);

  const visibleFiles = useMemo(() => {
    if (files.status !== "ready") return [];
    const base = filteredFiles;
    if (statusFilter === "all") return base;
    if (statusFilter === "attention") return base.filter((f) => f.segmentStatus.missing + f.segmentStatus.ambiguous > 0);
    if (statusFilter === "ok") return base.filter((f) => f.segmentStatus.missing + f.segmentStatus.ambiguous === 0);
    if (statusFilter === "missing") return base.filter((f) => f.segmentStatus.missing > 0);
    return base.filter((f) => f.segmentStatus.ambiguous > 0);
  }, [files.status, filteredFiles, statusFilter]);

  useEffect(() => {
    if (!activeSegment) return;
    const scroller = codeScrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector(`[data-line="${activeSegment.range.startLine}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "center" });
    }
  }, [activeSegment?.id]);

  function scrollToLine(lineNo: number): void {
    const scroller = codeScrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector(`[data-line="${lineNo}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "center" });
    }
    selectSegmentForLine(lineNo);
  }

  function jumpMatch(direction: 1 | -1): void {
    if (lineMatches.length === 0) return;
    const next = cycleIndex(matchIndex, lineMatches.length, direction);
    setMatchIndex(next);
    const lineNo = lineMatches[next];
    if (lineNo) scrollToLine(lineNo);
  }

  function selectSegmentForLine(lineNo: number): void {
    const seg = segments.find((s) => lineNo >= s.range.startLine && lineNo <= s.range.endLine);
    if (seg) setActiveSegmentId(seg.id);
  }

  async function save(): Promise<void> {
    if (activeFile.status !== "ready") return;
    if (!activeSegment) return;

    setSaving(true);
    setNotice("");
    try {
      const next = structuredClone(activeFile.data.dng) as ApiFileResponse["dng"];
      const idx = next.segments.findIndex((segment) => segment.id === activeSegment.id);
      if (idx >= 0) {
        const existingSegment = next.segments[idx];
        if (existingSegment) next.segments[idx] = { ...existingSegment, markdown: draftMarkdown };
      }
      next.updatedAt = new Date().toISOString();

      const res = await fetch(`/api/file?path=${encodeURIComponent(activePath)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dng: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setActiveFile({ status: "ready", data: { ...activeFile.data, dng: next } });
      await refreshFiles();
      setNotice("Saved.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setNotice(`Save failed: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  async function syncNow(): Promise<void> {
    if (!activePath) return;
    setSyncing(true);
    setNotice("");
    try {
      const res = await fetch(`/api/sync?path=${encodeURIComponent(activePath)}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok: true; dng: ApiFileResponse["dng"] };

      if (activeFile.status === "ready") {
        setActiveFile({ status: "ready", data: { ...activeFile.data, dng: data.dng } });
      }
      await refreshFiles();
      setNotice("Synced.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setNotice(`Sync failed: ${message}`);
    } finally {
      setSyncing(false);
    }
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

  async function exportSidecar(): Promise<void> {
    if (!activePath) return;
    setNotice("");
    try {
      const res = await fetch(`/api/sidecar?path=${encodeURIComponent(activePath)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const filename = sidecarFilenameForSourcePath(activePath, store);

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNotice("Sidecar downloaded.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setNotice(`Sidecar download failed: ${message}`);
    }
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
          <h1>Denigma</h1>
          <span className="muted">semantic sidecar for codebases</span>
        </div>
        <div className="topbarMeta">
          <div className="muted">
            {activePath ? activePath : "No file selected"} · store: {store === "dng" ? ".dng" : ".denigma"}
          </div>
          <div className="topbarActions">
            <button
              className={`toolBtn ${viewMode === "range" ? "toolBtnActive" : ""}`}
              onClick={() => setViewMode("range")}
              type="button"
            >
              Range
            </button>
            <button
              className={`toolBtn ${viewMode === "inline" ? "toolBtnActive" : ""}`}
              onClick={() => setViewMode("inline")}
              type="button"
            >
              Inline
            </button>
            <button className="toolBtn" onClick={() => exportMarkdown()} disabled={activeFile.status !== "ready"}>
              Export
            </button>
            <button className="toolBtn" onClick={() => void exportSidecar()} disabled={!activePath}>
              Sidecar
            </button>
            <button className="toolBtn" onClick={() => void syncNow()} disabled={!activePath || syncing}>
              {syncing ? "Syncing…" : "Sync"}
            </button>
            <button
              className="primaryBtn primaryBtnSmall"
              onClick={() => void save()}
              disabled={saving || activeFile.status !== "ready" || !activeSegment}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
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
            />
            <div className="spacer8" />
            <div className="row">
              <label className="muted" htmlFor="statusFilter">
                Status
              </label>
              <select
                id="statusFilter"
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                aria-label="Filter by status"
              >
                <option value="all">All</option>
                <option value="attention">Attention</option>
                <option value="ok">OK</option>
                <option value="missing">Missing</option>
                <option value="ambiguous">Ambiguous</option>
              </select>
            </div>
            <div className="spacer8" />
            {files.status === "loading" && <div className="muted">Loading…</div>}
            {files.status === "error" && <div>Failed: {files.message}</div>}
            {files.status === "ready" && (
              <div className="filesList">
                {(visibleFiles satisfies ApiFilesResponse["files"]).map((file) => {
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
          </div>
          <div className="panelBody">
            {activeFile.status !== "ready" && (
              <div className="muted">Select a tracked file to view its semantic sidecar.</div>
            )}
            {activeFile.status === "ready" && (
              <div className="editor">
                <div className="segments">
                  {(segments satisfies EditableSegment[]).map((segment) => {
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

                <div className="editorTabs" role="tablist" aria-label="Explanation editor tabs">
                  <button
                    className={`tabBtn ${editorTab === "edit" ? "tabBtnActive" : ""}`}
                    onClick={() => setEditorTab("edit")}
                    type="button"
                    role="tab"
                    aria-selected={editorTab === "edit"}
                  >
                    Edit
                  </button>
                  <button
                    className={`tabBtn ${editorTab === "preview" ? "tabBtnActive" : ""}`}
                    onClick={() => setEditorTab("preview")}
                    type="button"
                    role="tab"
                    aria-selected={editorTab === "preview"}
                  >
                    Preview
                  </button>
                </div>

                {editorTab === "edit" ? (
                  <textarea
                    className="textarea"
                    value={draftMarkdown}
                    onChange={(e) => setDraftMarkdown(e.target.value)}
                    placeholder="Write extremely verbose plain-English explanation here…"
                  />
                ) : (
                  <Suspense fallback={<div className="muted">Loading preview…</div>}>
                    <div className="markdown markdownPanel" role="tabpanel">
                      <Markdown markdown={draftMarkdown || "*No text.*"} />
                    </div>
                  </Suspense>
                )}

                {notice ? <div className="notice">{notice}</div> : null}
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
            </div>
          </div>
          <div className="panelBody codeBody" ref={codeScrollerRef}>
            {activeFile.status === "idle" && <div className="muted">Pick a tracked file.</div>}
            {activeFile.status === "loading" && <div className="muted">Loading…</div>}
            {activeFile.status === "error" && <div>Failed: {activeFile.message}</div>}
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
                                <Suspense fallback={<div className="muted">Loading…</div>}>
                                  <div className="markdown inlineExplainBody">
                                    <Markdown markdown={seg.markdown} />
                                  </div>
                                </Suspense>
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
