import { describe, expect, test } from "vitest";
import { createProgram } from "../src/cli.js";

describe("createProgram", () => {
  test("registers core commands", () => {
    const program = createProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toEqual(
      expect.arrayContaining(["init", "track", "sync", "sync-all", "status", "import-comments", "strip-comments", "serve"]),
    );
  });
});
