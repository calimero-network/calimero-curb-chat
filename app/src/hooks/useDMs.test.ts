import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDMs } from "./useDMs";

const {
  mockListGroupContexts,
  mockResolveCurrentMemberIdentity,
  mockGetContextInfo,
  mockGetProfiles,
  mockFetchContextIdentities,
  mockGetGroupMemberIdentity,
  mockSetGroupMemberIdentity,
} = vi.hoisted(() => ({
  mockListGroupContexts: vi.fn(),
  mockResolveCurrentMemberIdentity: vi.fn(),
  mockGetContextInfo: vi.fn(),
  mockGetProfiles: vi.fn(),
  mockFetchContextIdentities: vi.fn(),
  mockGetGroupMemberIdentity: vi.fn(),
  mockSetGroupMemberIdentity: vi.fn(),
}));

vi.mock("../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {
    listGroupContexts = mockListGroupContexts;
    resolveCurrentMemberIdentity = mockResolveCurrentMemberIdentity;
  },
}));

vi.mock("../api/dataSource/clientApiDataSource", () => ({
  ClientApiDataSource: class MockClientApiDataSource {
    getContextInfo = mockGetContextInfo;
    getProfiles = mockGetProfiles;
  },
}));

vi.mock("@calimero-network/calimero-client", () => ({
  apiClient: {
    node: () => ({
      fetchContextIdentities: mockFetchContextIdentities,
    }),
  },
}));

vi.mock("../constants/config", () => ({
  getGroupMemberIdentity: mockGetGroupMemberIdentity,
  setGroupMemberIdentity: mockSetGroupMemberIdentity,
}));

describe("useDMs", () => {
  beforeEach(() => {
    mockListGroupContexts.mockReset();
    mockResolveCurrentMemberIdentity.mockReset();
    mockGetContextInfo.mockReset();
    mockGetProfiles.mockReset();
    mockFetchContextIdentities.mockReset();
    mockGetGroupMemberIdentity.mockReset();
    mockSetGroupMemberIdentity.mockReset();

    mockGetGroupMemberIdentity.mockReturnValue("member-me");
    mockResolveCurrentMemberIdentity.mockResolvedValue({
      data: {
        memberIdentity: "member-me",
      },
      error: null,
    });
  });

  it("prefers shared DM metadata for unjoined DM discovery", async () => {
    mockListGroupContexts.mockResolvedValue({
      data: [
        {
          contextId: "ctx-1",
          alias: "channel-like-alias",
          sharedContextType: "Dm",
          memberIdentities: ["member-me", "member-you"],
        },
      ],
      error: null,
    });
    mockFetchContextIdentities.mockRejectedValue(new Error("not joined"));

    const { result } = renderHook(() => useDMs());

    let dms: Awaited<ReturnType<typeof result.current.fetchDms>> = [];
    await act(async () => {
      dms = await result.current.fetchDms("group-1");
    });

    expect(dms).toEqual([
      expect.objectContaining({
        contextId: "ctx-1",
        otherIdentity: "member-you",
        isJoined: false,
      }),
    ]);
  });

  it("falls back to alias parsing and keeps the participant identity when profiles are missing", async () => {
    mockListGroupContexts.mockResolvedValue({
      data: [
        {
          contextId: "ctx-me-you",
          alias: "DM_CONTEXT_member-me_member-you",
        },
        {
          contextId: "ctx-other",
          alias: "DM_CONTEXT_member-a_member-b",
        },
      ],
      error: null,
    });
    mockFetchContextIdentities.mockImplementation(async (contextId: string) => {
      if (contextId === "ctx-me-you") {
        return {
          data: {
            data: {
              identities: ["member-me"],
            },
          },
        };
      }

      throw new Error("not joined");
    });
    mockGetContextInfo.mockResolvedValue({
      data: {
        name: "DM",
        context_type: "Dm",
      },
      error: null,
    });
    mockGetProfiles.mockResolvedValue({
      data: [
        {
          identity: "member-me",
          username: "Me",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useDMs());

    let dms: Awaited<ReturnType<typeof result.current.fetchDms>> = [];
    await act(async () => {
      dms = await result.current.fetchDms("group-1");
    });

    expect(dms).toHaveLength(1);
    expect(dms[0]).toEqual(
      expect.objectContaining({
        contextId: "ctx-me-you",
        otherIdentity: "member-you",
        otherUsername: "",
        isJoined: true,
      }),
    );
  });
});
