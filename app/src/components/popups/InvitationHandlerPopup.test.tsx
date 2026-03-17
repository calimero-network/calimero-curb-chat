import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InvitationHandlerPopup from "./InvitationHandlerPopup";

const {
  mockClearInvitationFromStorage,
  mockGetInvitationFromStorage,
  mockJoinGroup,
  mockListGroupContexts,
  mockParseGroupInvitationPayload,
  mockSetGroupId,
  mockSetGroupMemberIdentity,
  mockSetStoredGroupAlias,
  mockSyncGroup,
} = vi.hoisted(() => ({
  mockClearInvitationFromStorage: vi.fn(),
  mockGetInvitationFromStorage: vi.fn(),
  mockJoinGroup: vi.fn(),
  mockListGroupContexts: vi.fn(),
  mockParseGroupInvitationPayload: vi.fn(),
  mockSetGroupId: vi.fn(),
  mockSetGroupMemberIdentity: vi.fn(),
  mockSetStoredGroupAlias: vi.fn(),
  mockSyncGroup: vi.fn(),
}));

vi.mock("@calimero-network/mero-ui", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("@calimero-network/calimero-client", () => ({
  apiClient: {
    node: () => ({
      createNewIdentity: vi.fn(),
      joinContextByOpenInvitation: vi.fn(),
      getContext: vi.fn(),
    }),
  },
  setContextId: vi.fn(),
  setExecutorPublicKey: vi.fn(),
}));

vi.mock("../../utils/invitation", () => ({
  clearInvitationFromStorage: mockClearInvitationFromStorage,
  getInvitationFromStorage: mockGetInvitationFromStorage,
  parseGroupInvitationPayload: mockParseGroupInvitationPayload,
}));

vi.mock("../../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {
    joinGroup = mockJoinGroup;
    syncGroup = mockSyncGroup;
    listGroupContexts = mockListGroupContexts;
  },
}));

vi.mock("../../constants/config", () => ({
  setGroupId: mockSetGroupId,
  setGroupMemberIdentity: mockSetGroupMemberIdentity,
  setStoredGroupAlias: mockSetStoredGroupAlias,
}));

describe("InvitationHandlerPopup", () => {
  beforeEach(() => {
    mockClearInvitationFromStorage.mockReset();
    mockGetInvitationFromStorage.mockReset();
    mockJoinGroup.mockReset();
    mockListGroupContexts.mockReset();
    mockParseGroupInvitationPayload.mockReset();
    mockSetGroupId.mockReset();
    mockSetGroupMemberIdentity.mockReset();
    mockSetStoredGroupAlias.mockReset();
    mockSyncGroup.mockReset();

    mockGetInvitationFromStorage.mockReturnValue("stored-invite");
    mockParseGroupInvitationPayload.mockReturnValue({
      invitation: {
        invitation: {
          inviter_identity: "admin",
          group_id: "group-1",
          expiration_height: 42,
          secret_salt: [1, 2, 3],
          protocol: "near",
          network: "testnet",
          contract_id: "contract.testnet",
        },
        inviter_signature: "signature",
      },
      groupAlias: "Team Space",
    });
    mockJoinGroup.mockResolvedValue({
      data: {
        groupId: "group-1",
        memberIdentity: "member-1",
      },
      error: null,
    });
    mockSyncGroup.mockResolvedValue({
      data: {
        groupId: "group-1",
      },
      error: null,
    });
    mockListGroupContexts.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it("stores the group alias locally when joining from a saved workspace invitation", async () => {
    const onSuccess = vi.fn();

    render(
      <InvitationHandlerPopup onSuccess={onSuccess} onError={vi.fn()} />,
    );

    await waitFor(() => {
      expect(mockJoinGroup).toHaveBeenCalledWith({
        invitation: {
          invitation: {
            inviter_identity: "admin",
            group_id: "group-1",
            expiration_height: 42,
            secret_salt: [1, 2, 3],
            protocol: "near",
            network: "testnet",
            contract_id: "contract.testnet",
          },
          inviter_signature: "signature",
        },
        groupAlias: "Team Space",
      });
    });

    expect(mockSetGroupId).toHaveBeenCalledWith("group-1");
    expect(mockSetGroupMemberIdentity).toHaveBeenCalledWith(
      "group-1",
      "member-1",
    );
    expect(mockSetStoredGroupAlias).toHaveBeenCalledWith(
      "group-1",
      "Team Space",
    );

    await waitFor(() => {
      expect(mockClearInvitationFromStorage).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
