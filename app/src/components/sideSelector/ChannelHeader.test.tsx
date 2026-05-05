import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChannelHeader from "./ChannelHeader";

const {
  mockGetGroupId,
  mockUseCurrentGroupPermissions,
  mockCreateGroupContext,
  mockGetGroup,
  mockSetContextVisibility,
  mockSetContextMemberIdentity,
} = vi.hoisted(() => ({
  mockGetGroupId: vi.fn(),
  mockUseCurrentGroupPermissions: vi.fn(),
  mockCreateGroupContext: vi.fn(),
  mockGetGroup: vi.fn(),
  mockSetContextVisibility: vi.fn(),
  mockSetContextMemberIdentity: vi.fn(),
}));

vi.mock("../../constants/config", () => ({
  getGroupId: mockGetGroupId,
  getApplicationId: () => "app-id",
  setContextMemberIdentity: mockSetContextMemberIdentity,
}));

vi.mock("../../hooks/useCurrentGroupPermissions", () => ({
  useCurrentGroupPermissions: mockUseCurrentGroupPermissions,
}));

vi.mock("../../hooks/usePersistentState", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    usePersistentState: (_key: string, initialValue: boolean | string) =>
      React.useState(initialValue),
  };
});

vi.mock("../../api/dataSource/nodeApiDataSource", () => ({
  ContextApiDataSource: class MockContextApiDataSource {
    createGroupContext = mockCreateGroupContext;
  },
}));

vi.mock("../../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {
    getGroup = mockGetGroup;
    setContextVisibility = mockSetContextVisibility;
  },
}));

vi.mock("@calimero-network/calimero-client", () => ({
  getAppEndpointKey: vi.fn(),
  getAuthConfig: vi.fn(),
  getContextId: vi.fn(),
  getExecutorPublicKey: vi.fn(),
  setExecutorPublicKey: vi.fn(),
  apiClient: { node: () => ({}) },
  getJsonRpcClient: vi.fn(() => ({ execute: vi.fn() })),
}));

vi.mock("../popups/CreateChannelPopup", () => ({
  default: ({
    toggle,
    createChannel,
  }: {
    toggle: React.ReactNode;
    createChannel: (
      channelName: string,
      isPublic: boolean,
      isReadOnly: boolean,
    ) => Promise<void>;
  }) => (
    <div>
      <div data-testid="create-channel-toggle">{toggle}</div>
      <button onClick={() => void createChannel("project-alpha", true, false)}>
        submit channel
      </button>
    </div>
  ),
}));

describe("ChannelHeader", () => {
  beforeEach(() => {
    mockGetGroupId.mockReset();
    mockUseCurrentGroupPermissions.mockReset();
    mockCreateGroupContext.mockReset();
    mockGetGroup.mockReset();
    mockSetContextVisibility.mockReset();
    mockSetContextMemberIdentity.mockReset();
    mockGetGroupId.mockReturnValue("group-1");
    mockGetGroup.mockResolvedValue({
      data: { defaultVisibility: "open" },
      error: null,
    });
    mockCreateGroupContext.mockResolvedValue({
      data: {
        contextId: "context-1",
        memberPublicKey: "member-key-1",
      },
      error: null,
    });
    mockSetContextVisibility.mockResolvedValue({
      data: undefined,
      error: null,
    });
  });

  it("shows the create channel action for all members (admin check removed)", () => {
    mockUseCurrentGroupPermissions.mockReturnValue({
      loading: false,
      isAdmin: false,
      canCreateContext: false,
    });

    render(<ChannelHeader title="Channels" />);

    expect(screen.getByTestId("create-channel-toggle")).toBeInTheDocument();
  });

  it("passes the channel name as the group-context alias when creating a channel", async () => {
    mockUseCurrentGroupPermissions.mockReturnValue({
      loading: false,
      isAdmin: true,
      canCreateContext: true,
    });

    render(<ChannelHeader title="Channels" />);

    fireEvent.click(screen.getByText("submit channel"));

    await waitFor(() => {
      expect(mockCreateGroupContext).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: "group-1",
          alias: "project-alpha",
          initializationParams: expect.objectContaining({
            name: "project-alpha",
          }),
        }),
      );
    });
  });
});
