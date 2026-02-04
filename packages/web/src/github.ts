import { parseDngFile, type DngFile } from "@denigma/core";
import type { ApiFileResponse, ApiFilesResponse } from "./types";

type GithubTreeEntry = { path: string; type: "blob" | "tree"; sha: string };

type GithubCommitResponse = {
  commit: { tree: { sha: string } };
};

type GithubTreeResponse = {
  truncated: boolean;
  tree: GithubTreeEntry[];
};

type GithubBlobResponse = {
  encoding: "base64";
  content: string;
};

type GithubBranchResponse = { name: string }[];

function apiBase(): string {
  return "https://api.github.com";
}

function baseHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function ghFetchJson<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { headers: baseHeaders(token) });
  if (!res.ok) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    const resetAt =
      reset && Number.isFinite(Number(reset)) ? new Date(Number(reset) * 1000).toLocaleString() : undefined;

    const text = await res.text().catch(() => "");
    const snippet = text.trim().slice(0, 300);

    const rateLimitHint =
      remaining === "0"
        ? ` (rate limit exceeded${resetAt ? `; resets ${resetAt}` : ""})`
        : remaining
          ? ` (rate remaining: ${remaining})`
          : "";

    throw new Error(`GitHub API HTTP ${res.status}${rateLimitHint}: ${snippet || path}`);
  }
  return (await res.json()) as T;
}

function decodeBase64Utf8(input: string): string {
  const cleaned = input.replaceAll("\n", "");
  const bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function computeSegmentStatusCounts(dng: DngFile): { ok: number; missing: number; ambiguous: number } {
  let ok = 0;
  let missing = 0;
  let ambiguous = 0;
  for (const seg of dng.segments) {
    if (seg.status === "missing") missing++;
    else if (seg.status === "ambiguous") ambiguous++;
    else ok++;
  }
  return { ok, missing, ambiguous };
}

async function getCommitTreeSha(owner: string, repo: string, ref: string, token?: string): Promise<string> {
  const data = await ghFetchJson<GithubCommitResponse>(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, token);
  return data.commit.tree.sha;
}

async function getRepoTree(owner: string, repo: string, ref: string, token?: string): Promise<Map<string, string>> {
  const treeSha = await getCommitTreeSha(owner, repo, ref, token);
  const data = await ghFetchJson<GithubTreeResponse>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,
    token,
  );
  if (data.truncated) {
    throw new Error("GitHub tree response was truncated (repo too large for this mode)");
  }
  const map = new Map<string, string>();
  for (const e of data.tree) {
    if (e.type === "blob") map.set(e.path, e.sha);
  }
  return map;
}

async function getBlobText(owner: string, repo: string, sha: string, token?: string): Promise<string> {
  const data = await ghFetchJson<GithubBlobResponse>(`/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(sha)}`, token);
  return decodeBase64Utf8(data.content);
}

export type GithubRepoConfig = {
  owner: string;
  repo: string;
  ref: string;
  token?: string;
};

export type GithubRepoState = {
  config: GithubRepoConfig;
  blobs: Map<string, string>;
  sourceToDngPath: Map<string, string>;
  blobTextCache: Map<string, string>;
};

export async function connectGithubRepo(config: GithubRepoConfig): Promise<GithubRepoState> {
  const blobs = await getRepoTree(config.owner, config.repo, config.ref, config.token);
  return { config, blobs, sourceToDngPath: new Map(), blobTextCache: new Map() };
}

export async function listBranches(owner: string, repo: string, token?: string): Promise<string[]> {
  const data = await ghFetchJson<GithubBranchResponse>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
    token,
  );
  return data.map((b) => b.name).filter(Boolean);
}

async function getBlobTextCached(state: GithubRepoState, sha: string): Promise<string> {
  const cached = state.blobTextCache.get(sha);
  if (cached !== undefined) return cached;
  const text = await getBlobText(state.config.owner, state.config.repo, sha, state.config.token);
  state.blobTextCache.set(sha, text);
  return text;
}

export async function listDenigmaFiles(state: GithubRepoState): Promise<ApiFilesResponse> {
  const dngPaths = Array.from(state.blobs.keys()).filter(
    (p) => p.startsWith(".denigma/files/") && p.endsWith(".dng.json"),
  );

  state.sourceToDngPath.clear();

  const files: ApiFilesResponse["files"] = [];
  for (const dngPath of dngPaths) {
    const sha = state.blobs.get(dngPath);
    if (!sha) continue;
    try {
      const text = await getBlobTextCached(state, sha);
      const parsed = parseDngFile(JSON.parse(text));
      state.sourceToDngPath.set(parsed.sourcePath, dngPath);
      files.push({
        sourcePath: parsed.sourcePath,
        updatedAt: parsed.updatedAt,
        segmentStatus: computeSegmentStatusCounts(parsed),
      });
    } catch {
      // Skip unreadable entries.
    }
  }

  files.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return { files };
}

export async function getDenigmaFile(state: GithubRepoState, sourcePath: string): Promise<ApiFileResponse> {
  const dngPath = state.sourceToDngPath.get(sourcePath);
  if (!dngPath) throw new Error("No .dng file found for path (try reloading file list)");

  const dngSha = state.blobs.get(dngPath);
  if (!dngSha) throw new Error("Missing .dng blob in tree");

  const dngText = await getBlobTextCached(state, dngSha);
  const dng = parseDngFile(JSON.parse(dngText));

  const sourceSha = state.blobs.get(sourcePath);
  if (!sourceSha) throw new Error("Source file not found in repo tree");
  const sourceText = await getBlobTextCached(state, sourceSha);

  return { sourcePath, sourceText, dng };
}
