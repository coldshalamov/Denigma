import { describe, expect, test } from "vitest";
import { decodeViewerState, encodeViewerState } from "./urlState";

describe("urlState", () => {
  test("round-trips state to query string", () => {
    const search = encodeViewerState({
      owner: "octo",
      repo: "hello-world",
      ref: "main",
      baseDir: "examples/demo-repo",
      path: "src/index.ts",
      segment: "seg-1",
      mode: "inline",
      fileQuery: "src/",
      status: "attention",
    });
    expect(search.startsWith("?")).toBe(true);

    const decoded = decodeViewerState(search);
    expect(decoded).toEqual({
      owner: "octo",
      repo: "hello-world",
      ref: "main",
      baseDir: "examples/demo-repo",
      path: "src/index.ts",
      segment: "seg-1",
      mode: "inline",
      fileQuery: "src/",
      status: "attention",
    });
  });

  test("ignores invalid mode/status values", () => {
    const decoded = decodeViewerState("?mode=weird&status=nope");
    expect(decoded.mode).toBeUndefined();
    expect(decoded.status).toBeUndefined();
  });
});
