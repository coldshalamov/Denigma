import { describe, expect, test } from "vitest";
import { cycleIndex, findLineMatches } from "./search";

describe("search helpers", () => {
  test("findLineMatches is case-insensitive and returns 1-based line numbers", () => {
    const lines = ["One", "two", "THREE"];
    expect(findLineMatches(lines, "t")).toEqual([2, 3]);
    expect(findLineMatches(lines, "THREE")).toEqual([3]);
    expect(findLineMatches(lines, " ")).toEqual([]);
  });

  test("cycleIndex wraps", () => {
    expect(cycleIndex(-1, 3, 1)).toBe(0);
    expect(cycleIndex(0, 3, 1)).toBe(1);
    expect(cycleIndex(2, 3, 1)).toBe(0);
    expect(cycleIndex(0, 3, -1)).toBe(2);
  });
});

