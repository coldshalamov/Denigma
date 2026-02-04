import { describe, expect, test } from "vitest";
import { encodeRepoRelativePathToDngName } from "../src/paths.js";

describe("encodeRepoRelativePathToDngName", () => {
  test("produces stable, filesystem-safe name", () => {
    expect(encodeRepoRelativePathToDngName("src/app.ts")).toBe("src__app.ts.dng.json");
    expect(encodeRepoRelativePathToDngName("a/b/c.ts")).toBe("a__b__c.ts.dng.json");
  });
});

