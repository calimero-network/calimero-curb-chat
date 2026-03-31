import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredGroupAlias, setStoredGroupAlias } from "./config";

describe("config group alias cache", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores and reads trimmed group aliases", () => {
    setStoredGroupAlias("group-1", "  Team Space  ");

    expect(getStoredGroupAlias("group-1")).toBe("Team Space");
  });

  it("treats storage failures as a best-effort cache miss", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => setStoredGroupAlias("group-1", "Team Space")).not.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(getStoredGroupAlias("group-1")).toBe("");
  });
});
