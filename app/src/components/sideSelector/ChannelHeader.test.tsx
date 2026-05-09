import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChannelHeader from "./ChannelHeader";

const {
  mockGetGroupId,
  mockUseCurrentGroupPermissions,
  mockCreateGroupContext,
  mockCreateSubgroup,
  mockSetSubgroupVisibility,
  mockGetGroup,
  mockSetContextMemberIdentity,
  mockJoinChat,
} = vi.hoisted(() => ({
  mockGetGroupId: vi.fn(),
  mockUseCurrentGroupPermissions: vi.fn(),
  mockCreateGroupContext: vi.fn(),
  mockCreateSubgroup: vi.fn(),
  mockSetSubgroupVisibility: vi.fn(),
  mockGetGroup: vi.fn(),
  mockSetContextMemberIdentity: vi.fn(),
  mockJoinChat: vi.fn(),
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
    createSubgroup = mockCreateSubgroup;
    setSubgroupVisibility = mockSetSubgroupVisibility;
    getGroup = mockGetGroup;
  },
}));

vi.mock("../../api/dataSource/clientApiDataSource", () => ({
  ClientApiDataSource: class MockClientApiDataSource {
    joinChat = mockJoinChat;
  },
}));

vi.mock("@calimero-network/mero-react", () => ({
  getNodeUrl: vi.fn(),
  getContextId: vi.fn(),
  getContextIdentity: vi.fn(),
  setContextIdentity: vi.fn(),
}));

vi.mock("../../api/meroJsClient", () => ({
  getAuthConfig: vi.fn(),
  nodeApi: {},
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
    mockCreateSubgroup.mockReset();
    mockSetSubgroupVisibility.mockReset();
    mockGetGroup.mockReset();
    mockSetContextMemberIdentity.mockReset();
    mockJoinChat.mockReset();

    mockGetGroupId.mockReturnValue("group-1");
    mockGetGroup.mockResolvedValue({
      data: { subgroupVisibility: "open" },
      error: null,
    });
    mockCreateSubgroup.mockResolvedValue({
      data: { groupId: "subgroup-1" },
      error: null,
    });
    mockSetSubgroupVisibility.mockResolvedValue({
      data: undefined,
      error: null,
    });
    mockCreateGroupContext.mockResolvedValue({
      data: {
        contextId: "context-1",
        memberPublicKey: "member-key-1",
      },
      error: null,
    });
    mockJoinChat.mockResolvedValue({ data: undefined, error: null });
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

  it("creates a subgroup with the channel name, sets visibility, then creates the context inside it", async () => {
    mockUseCurrentGroupPermissions.mockReturnValue({
      loading: false,
      isAdmin: true,
      canCreateContext: true,
    });

    render(<ChannelHeader title="Channels" />);

    fireEvent.click(screen.getByText("submit channel"));

    await waitFor(() => {
      expect(mockCreateSubgroup).toHaveBeenCalledWith("group-1", {
        groupAlias: "project-alpha",
      });
    });

    expect(mockSetSubgroupVisibility).toHaveBeenCalledWith("subgroup-1", {
      subgroupVisibility: "open",
    });

    expect(mockCreateGroupContext).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "subgroup-1",
        alias: "project-alpha",
        initializationParams: expect.objectContaining({
          name: "project-alpha",
        }),
      }),
    );
  });
});
