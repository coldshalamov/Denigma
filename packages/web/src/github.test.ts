import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { listBranches, listDenigmaFiles, type GithubRepoState } from "./github";

describe("github module", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("listBranches returns branch names", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => [{ name: "main" }, { name: "dev" }],
    });

    const branches = await listBranches("octo", "repo", "token");
    expect(branches).toEqual(["main", "dev"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("listDenigmaFiles uses an in-memory blob cache", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

    const dng = {
      schemaVersion: 1,
      sourcePath: "src/a.ts",
      sourceSha256: "x",
      createdAt: "2026-02-03T00:00:00.000Z",
      updatedAt: "2026-02-03T00:00:00.000Z",
      segments: [],
    };

    const base64 = Buffer.from(JSON.stringify(dng), "utf8").toString("base64");

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ encoding: "base64", content: base64 }),
    });

    const state: GithubRepoState = {
      config: { owner: "octo", repo: "repo", ref: "main" },
      blobs: new Map([[".denigma/files/a.dng.json", "sha-dng"]]),
      sourceToDngPath: new Map(),
      blobTextCache: new Map(),
    };

    await listDenigmaFiles(state);
    await listDenigmaFiles(state);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
