import { describe, expect, test } from "bun:test";
import { isVersionNewer } from "../src/utils/version.ts";

describe("version checks", () => {
  test("only reports versions newer than the current release", () => {
    expect(isVersionNewer("1.0.6", "1.0.5")).toBe(true);
    expect(isVersionNewer("1.0.5", "1.0.6")).toBe(false);
    expect(isVersionNewer("1.0.6", "1.0.6")).toBe(false);
  });

  test("compares numeric version segments instead of strings", () => {
    expect(isVersionNewer("1.0.10", "1.0.9")).toBe(true);
    expect(isVersionNewer("2.0.0", "1.99.99")).toBe(true);
    expect(isVersionNewer("invalid", "1.0.6")).toBe(false);
  });
});
