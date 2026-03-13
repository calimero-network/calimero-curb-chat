import { describe, expect, it } from "vitest";
import {
  getCachedUsernameForIdentity,
  setCachedUsernameForIdentity,
} from "./chatProfileCache";

describe("chatProfileCache", () => {
  it("stores and reads usernames per identity", () => {
    setCachedUsernameForIdentity("identity-1", "alice");
    setCachedUsernameForIdentity("identity-2", "bob");

    expect(getCachedUsernameForIdentity("identity-1")).toBe("alice");
    expect(getCachedUsernameForIdentity("identity-2")).toBe("bob");
  });

  it("returns an empty string for unknown identities", () => {
    expect(getCachedUsernameForIdentity("missing")).toBe("");
  });
});
