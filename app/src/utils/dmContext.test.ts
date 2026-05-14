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

  it("creates a restricted DM subgroup + context with the deterministic alias", async () => {
    const createGroupContext = vi.fn().mockResolvedValue({
      data: {
        contextId: "ctx-1",
        memberPublicKey: "member-a",
      },
      error: null,
    });
    const createSubgroup = vi.fn().mockResolvedValue({
      data: { groupId: "dm-sg-1" },
      error: null,
    });
    const setSubgroupVisibility = vi.fn().mockResolvedValue({
      data: undefined,
      error: null,
    });
    const addGroupMember = vi.fn().mockResolvedValue({
      data: undefined,
      error: null,
    });

    const result = await createDmContextInGroup({
      applicationId: "app-1",
      groupId: "namespace-1",
      myIdentity: "member-b",
      otherIdentity: "member-a",
      otherUsername: "Alice",
      contextApi: {
        createGroupContext,
      },
      groupApi: {
        createSubgroup,
        setSubgroupVisibility,
        addGroupMember,
      },
    });

    expect(result.error).toBe("");
    expect(result.alias).toBe("DM_CONTEXT_member-a_member-b");
    expect(createSubgroup).toHaveBeenCalledWith("namespace-1", {
      groupAlias: "DM_CONTEXT_member-a_member-b",
    });
    expect(setSubgroupVisibility).toHaveBeenCalledWith("dm-sg-1", {
      subgroupVisibility: "restricted",
    });
    expect(addGroupMember).toHaveBeenCalledWith("dm-sg-1", "member-a");
    expect(createGroupContext).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "dm-sg-1",
        alias: "DM_CONTEXT_member-a_member-b",
        initializationParams: expect.objectContaining({
          context_type: "Dm",
          name: "DM: Alice",
        }),
      }),
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

    // Both per-viewer sources empty → fall back to placeholder, never
    // the raw identity hash. (The WASM info.name fallback was removed
    // because info.name is shared across both DM participants, so
    // using it would make the recipient see their own name as the DM
    // title.)
    expect(
      getDmDisplayName({
        contextId: "ctx-1",
        otherUsername: "",
        otherAlias: "",
        otherIdentity: "member-a",
      }),
    ).toBe("Direct message");
  });
});
