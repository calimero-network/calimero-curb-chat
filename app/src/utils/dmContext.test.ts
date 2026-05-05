import { describe, expect, it, vi } from "vitest";
import {
  buildDmAlias,
  createDmContextInGroup,
  getDmDisplayName,
  parseDmAlias,
  resolveSharedDmDiscovery,
} from "./dmContext";

describe("dmContext", () => {
  it("builds the same alias regardless of member ordering", () => {
    const first = buildDmAlias("member-b", "member-a");
    const second = buildDmAlias("member-a", "member-b");

    expect(first).toBe("DM_CONTEXT_member-a_member-b");
    expect(second).toBe(first);
    expect(parseDmAlias(first)).toEqual({
      memberIdentities: ["member-a", "member-b"],
    });
  });

  it("prefers shared DM metadata before alias parsing", () => {
    const discovery = resolveSharedDmDiscovery(
      {
        contextId: "ctx-1",
        alias: "not-a-dm",
        sharedContextType: "Dm",
        memberIdentities: ["me", "you"],
      },
      "me",
    );

    expect(discovery).toEqual({
      source: "metadata",
      memberIdentities: ["me", "you"],
      otherIdentity: "you",
    });
  });

  it("passes the deterministic alias into group context creation", async () => {
    const createGroupContext = vi.fn().mockResolvedValue({
      data: {
        contextId: "ctx-1",
        memberPublicKey: "member-a",
      },
      error: null,
    });
    const setContextVisibility = vi.fn().mockResolvedValue({
      data: undefined,
      error: null,
    });
    const manageContextAllowlist = vi.fn().mockResolvedValue({
      data: undefined,
      error: null,
    });

    const result = await createDmContextInGroup({
      applicationId: "app-1",
      groupId: "group-1",
      myIdentity: "member-b",
      otherIdentity: "member-a",
      otherUsername: "Alice",
      contextApi: {
        createGroupContext,
      },
      groupApi: {
        setContextVisibility,
        manageContextAllowlist,
      },
    });

    expect(result.error).toBe("");
    expect(result.alias).toBe("DM_CONTEXT_member-a_member-b");
    expect(createGroupContext).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "group-1",
        alias: "DM_CONTEXT_member-a_member-b",
        initializationParams: expect.objectContaining({
          context_type: "Dm",
          name: "DM: Alice",
        }),
      }),
    );
    expect(setContextVisibility).toHaveBeenCalledWith(
      "group-1",
      "ctx-1",
      { mode: "restricted" },
    );
    expect(manageContextAllowlist).toHaveBeenCalledWith(
      "group-1",
      "ctx-1",
      { add: ["member-b", "member-a"] },
    );
  });

  it("prefers the username but falls back to the participant identity", () => {
    expect(
      getDmDisplayName({
        contextId: "ctx-1",
        otherUsername: "Alice",
        otherAlias: "Alice Alias",
        otherIdentity: "member-a",
      }),
    ).toBe("Alice");

    expect(
      getDmDisplayName({
        contextId: "ctx-1",
        otherUsername: "",
        otherAlias: "Alice Alias",
        otherIdentity: "member-a",
      }),
    ).toBe("Alice Alias");

    expect(
      getDmDisplayName({
        contextId: "ctx-1",
        otherUsername: "",
        otherAlias: "",
        otherIdentity: "member-a",
      }),
    ).toBe("member-a");
  });
});
