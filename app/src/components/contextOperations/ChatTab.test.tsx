import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatTab from "./ChatTab";

const {
  mockNavigate,
  mockListGroups,
  mockJoinGroup,
  mockResolveCurrentMemberIdentity,
  mockSetGroupMemberIdentity,
  mockSetGroupId,
  mockGetGroupId,
  mockGetGroupMemberIdentity,
  mockGetMessengerDisplayName,
  mockSetMessengerDisplayName,
  mockClearStoredSession,
  mockParseInvitationInput,
  mockParseGroupInvitationPayload,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockListGroups: vi.fn(),
  mockJoinGroup: vi.fn(),
  mockResolveCurrentMemberIdentity: vi.fn(),
  mockSetGroupMemberIdentity: vi.fn(),
  mockSetGroupId: vi.fn(),
  mockGetGroupId: vi.fn(),
  mockGetGroupMemberIdentity: vi.fn(),
  mockGetMessengerDisplayName: vi.fn(),
  mockSetMessengerDisplayName: vi.fn(),
  mockClearStoredSession: vi.fn(),
  mockParseInvitationInput: vi.fn(),
  mockParseGroupInvitationPayload: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@calimero-network/calimero-client", () => ({
  getAppEndpointKey: () => "test-app-endpoint",
}));

vi.mock("../../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {
    listGroups = mockListGroups;
    joinGroup = mockJoinGroup;
    resolveCurrentMemberIdentity = mockResolveCurrentMemberIdentity;
  },
}));

vi.mock("../../constants/config", () => ({
  getGroupId: mockGetGroupId,
  getGroupMemberIdentity: mockGetGroupMemberIdentity,
  setGroupId: mockSetGroupId,
  setGroupMemberIdentity: mockSetGroupMemberIdentity,
}));

vi.mock("../../utils/messengerName", () => ({
  getMessengerDisplayName: mockGetMessengerDisplayName,
  setMessengerDisplayName: mockSetMessengerDisplayName,
}));

vi.mock("../../utils/session", () => ({
  clearStoredSession: mockClearStoredSession,
}));

vi.mock("../../utils/invitation", () => ({
  parseInvitationInput: mockParseInvitationInput,
  parseGroupInvitationPayload: mockParseGroupInvitationPayload,
}));

function makeGroup(groupId: string) {
  return {
    groupId,
    appKey: "test-app",
    targetApplicationId: "test-target",
    upgradePolicy: "Automatic" as const,
    createdAt: 0,
  };
}

function renderChatTab(props?: Partial<ComponentProps<typeof ChatTab>>) {
  return render(
    <MemoryRouter>
      <ChatTab
        isAuthenticated={true}
        isConfigSet={true}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("ChatTab", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockListGroups.mockReset();
    mockJoinGroup.mockReset();
    mockResolveCurrentMemberIdentity.mockReset();
    mockSetGroupMemberIdentity.mockReset();
    mockSetGroupId.mockReset();
    mockGetGroupId.mockReset();
    mockGetGroupMemberIdentity.mockReset();
    mockGetMessengerDisplayName.mockReset();
    mockSetMessengerDisplayName.mockReset();
    mockClearStoredSession.mockReset();
    mockParseInvitationInput.mockReset();
    mockParseGroupInvitationPayload.mockReset();

    mockGetGroupId.mockReturnValue("");
    mockGetGroupMemberIdentity.mockReturnValue("");
    mockGetMessengerDisplayName.mockReturnValue("Ronit");
    mockListGroups.mockResolvedValue({
      data: [makeGroup("group-1")],
    });
  });

  it("shows the invitation entry even when workspaces already exist", async () => {
    renderChatTab();

    await waitFor(() => {
      expect(mockListGroups).toHaveBeenCalled();
    });

    expect(
      screen.getByText(/join workspace with invitation/i),
    ).toBeInTheDocument();
  });

  it("joins a workspace from invitation and selects the joined workspace", async () => {
    const onInvitationSaved = vi.fn();
    const joinedInvitation = {
      invitation: {
        inviter_identity: "admin",
        group_id: "group-2",
        expiration_height: 999999999,
        secret_salt: [1, 2, 3],
        protocol: "near",
        network: "testnet",
        contract_id: "contract.testnet",
      },
      inviter_signature: "signature",
    };

    mockListGroups
      .mockResolvedValueOnce({
        data: [makeGroup("group-1")],
      })
      .mockResolvedValueOnce({
        data: [makeGroup("group-1"), makeGroup("group-2")],
      });
    mockParseInvitationInput.mockReturnValue("decoded-payload");
    mockParseGroupInvitationPayload.mockReturnValue(joinedInvitation);
    mockJoinGroup.mockResolvedValue({
      data: {
        groupId: "group-2",
        memberIdentity: "member-2",
      },
    });

    renderChatTab({
      onInvitationSaved,
    });

    await waitFor(() => {
      expect(mockListGroups).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(
      screen.getByPlaceholderText(
        /https:\/\/\.\.\.\?invitation=.*paste encoded/i,
      ),
      {
        target: { value: "invite-link" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /use invitation/i }),
    );

    await waitFor(() => {
      expect(mockJoinGroup).toHaveBeenCalledWith({
        invitation: joinedInvitation,
      });
    });

    await waitFor(() => {
      expect(mockSetGroupMemberIdentity).toHaveBeenCalledWith(
        "group-2",
        "member-2",
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("combobox"),
      ).toHaveValue("group-2");
    });

    expect(onInvitationSaved).toHaveBeenCalled();
  });

  it("keeps the joined workspace enterable when the post-join refresh fails", async () => {
    const joinedInvitation = {
      invitation: {
        inviter_identity: "admin",
        group_id: "group-2",
        expiration_height: 999999999,
        secret_salt: [1, 2, 3],
        protocol: "near",
        network: "testnet",
        contract_id: "contract.testnet",
      },
      inviter_signature: "signature",
    };

    mockListGroups
      .mockResolvedValueOnce({
        data: [makeGroup("group-1")],
      })
      .mockRejectedValueOnce(new Error("refresh failed"));
    mockParseInvitationInput.mockReturnValue("decoded-payload");
    mockParseGroupInvitationPayload.mockReturnValue(joinedInvitation);
    mockJoinGroup.mockResolvedValue({
      data: {
        groupId: "group-2",
        memberIdentity: "member-2",
      },
    });
    mockResolveCurrentMemberIdentity.mockResolvedValue({
      data: {
        memberIdentity: "resolved-member-2",
      },
    });

    renderChatTab();

    await waitFor(() => {
      expect(mockListGroups).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(
      screen.getByPlaceholderText(
        /https:\/\/\.\.\.\?invitation=.*paste encoded/i,
      ),
      {
        target: { value: "invite-link" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /use invitation/i }),
    );

    const joinChatButton = await screen.findByRole("button", {
      name: /join chat/i,
    });

    expect(screen.getByRole("combobox")).toHaveValue("group-2");

    fireEvent.click(joinChatButton);

    await waitFor(() => {
      expect(mockResolveCurrentMemberIdentity).toHaveBeenCalledWith(
        "group-2",
        "",
      );
    });

    expect(mockSetGroupId).toHaveBeenCalledWith("group-2");
    expect(mockSetMessengerDisplayName).toHaveBeenCalledWith("Ronit");
    expect(mockSetGroupMemberIdentity).toHaveBeenCalledWith(
      "group-2",
      "resolved-member-2",
    );
    expect(mockClearStoredSession).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
