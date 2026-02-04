export type UrlViewMode = "range" | "inline";

export type ViewerUrlState = {
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  segment?: string;
  mode?: UrlViewMode;
  fileQuery?: string;
  status?: "all" | "attention" | "ok" | "missing" | "ambiguous";
};

function setIfNonEmpty(params: URLSearchParams, key: string, value?: string): void {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  params.set(key, trimmed);
}

export function encodeViewerState(state: ViewerUrlState): string {
  const params = new URLSearchParams();
  setIfNonEmpty(params, "owner", state.owner);
  setIfNonEmpty(params, "repo", state.repo);
  setIfNonEmpty(params, "ref", state.ref);
  setIfNonEmpty(params, "path", state.path);
  setIfNonEmpty(params, "seg", state.segment);
  setIfNonEmpty(params, "mode", state.mode);
  setIfNonEmpty(params, "q", state.fileQuery);
  setIfNonEmpty(params, "status", state.status);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function decodeViewerState(search: string): ViewerUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const owner = params.get("owner");
  const repo = params.get("repo");
  const ref = params.get("ref");
  const path = params.get("path");
  const segment = params.get("seg");
  const q = params.get("q");
  const modeRaw = params.get("mode");
  const statusRaw = params.get("status");

  const state: ViewerUrlState = {};
  if (owner) state.owner = owner;
  if (repo) state.repo = repo;
  if (ref) state.ref = ref;
  if (path) state.path = path;
  if (segment) state.segment = segment;
  if (q) state.fileQuery = q;

  const mode: UrlViewMode | undefined = modeRaw === "inline" || modeRaw === "range" ? modeRaw : undefined;
  if (mode) state.mode = mode;

  const status: ViewerUrlState["status"] =
    statusRaw === "all" ||
    statusRaw === "attention" ||
    statusRaw === "ok" ||
    statusRaw === "missing" ||
    statusRaw === "ambiguous"
      ? statusRaw
      : undefined;
  if (status) state.status = status;

  return state;
}
