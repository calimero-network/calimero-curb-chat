import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateWorkspacePopup from "./CreateWorkspacePopup";

const {
  mockAxiosGet,
  mockCreateGroup,
  mockResolveCurrentMemberIdentity,
  mockSetDefaultCapabilities,
  mockCreateInvitation,
  mockCreateGroupContext,
  mockSetGroupId,
  mockSetGroupMemberIdentity,
  mockSerializeGroupInvitationPayload,
} = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockCreateGroup: vi.fn(),
  mockResolveCurrentMemberIdentity: vi.fn(),
  mockSetDefaultCapabilities: vi.fn(),
  mockCreateInvitation: vi.fn(),
  mockCreateGroupContext: vi.fn(),
  mockSetGroupId: vi.fn(),
  mockSetGroupMemberIdentity: vi.fn(),
  mockSerializeGroupInvitationPayload: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: mockAxiosGet,
  },
}));

vi.mock("@calimero-network/mero-ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@calimero-network/calimero-client", () => ({
  getAppEndpointKey: () => "http://localhost:2428",
  getAuthConfig: () => ({ jwtToken: "token" }),
}));

vi.mock("../../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {
    createGroup = mockCreateGroup;
    resolveCurrentMemberIdentity = mockResolveCurrentMemberIdentity;
    setDefaultCapabilities = mockSetDefaultCapabilities;
    createInvitation = mockCreateInvitation;
  },
}));

vi.mock("../../api/dataSource/nodeApiDataSource", () => ({
  ContextApiDataSource: class MockContextApiDataSource {
    createGroupContext = mockCreateGroupContext;
  },
}));

vi.mock("../../constants/config", () => ({
  getApplicationId: () => "app-1",
  setGroupId: mockSetGroupId,
  setGroupMemberIdentity: mockSetGroupMemberIdentity,
}));

vi.mock("../../utils/invitation", () => ({
  serializeGroupInvitationPayload: mockSerializeGroupInvitationPayload,
}));

vi.mock("./GroupInviteModal", () => ({
  default: ({
    groupId,
    title,
    subtitle,
    successMessage,
  }: {
    groupId: string;
    title: string;
    subtitle: string;
    successMessage: string;
  }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div>{successMessage}</div>
      <div>Workspace ID: {groupId}</div>
    </div>
  ),
}));

describe("CreateWorkspacePopup", () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockCreateGroup.mockReset();
    mockResolveCurrentMemberIdentity.mockReset();
    mockSetDefaultCapabilities.mockReset();
    mockCreateInvitation.mockReset();
    mockCreateGroupContext.mockReset();
    mockSetGroupId.mockReset();
    mockSetGroupMemberIdentity.mockReset();
    mockSerializeGroupInvitationPayload.mockReset();

    mockAxiosGet.mockResolvedValue({
      data: {
        data: {
          apps: [{ id: "app-1" }],
        },
      },
    });
    mockCreateGroup.mockResolvedValue({
      data: {
        groupId: "group-1",
      },
    });
    mockSetDefaultCapabilities.mockResolvedValue({ data: undefined, error: null });
    mockResolveCurrentMemberIdentity.mockResolvedValue({
      data: {
        memberIdentity: "member-1",
      },
    });
    mockCreateInvitation.mockResolvedValue({
      data: {
        invitation: {
          invitation: "payload",
        },
        groupAlias: "Team Space",
      },
    });
    mockSerializeGroupInvitationPayload.mockReturnValue("serialized-invite");
  });

  it("describes workspace-only creation without a default general channel", () => {
    render(<CreateWorkspacePopup onSuccess={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByText(/#general/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/add channels after you enter the workspace/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /workspace name/i }),
    ).toBeInTheDocument();
  });

  it("requires a workspace name before creation is enabled", () => {
    render(<CreateWorkspacePopup onSuccess={vi.fn()} onCancel={vi.fn()} />);

    const createButton = screen.getByRole("button", {
      name: /create workspace/i,
    });
    const nameInput = screen.getByRole("textbox", {
      name: /workspace name/i,
    });

    expect(createButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "   " } });
    expect(createButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "Team Space" } });
    expect(createButton).toBeEnabled();
  });

  it("creates only the workspace and invitation during onboarding", async () => {
    render(<CreateWorkspacePopup onSuccess={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: /workspace name/i }), {
      target: { value: "  Team Space  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /create workspace/i }),
    );

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({
        applicationId: "app-1",
        upgradePolicy: "LazyOnAccess",
        alias: "Team Space",
      });
    });

    await waitFor(() => {
      expect(mockCreateInvitation).toHaveBeenCalledWith("group-1");
    });

    expect(mockCreateGroupContext).not.toHaveBeenCalled();
    expect(mockSetGroupId).toHaveBeenCalledWith("group-1");
    expect(mockSetGroupMemberIdentity).toHaveBeenCalledWith(
      "group-1",
      "member-1",
    );
    expect(mockSerializeGroupInvitationPayload).toHaveBeenCalledWith({
      invitation: {
        invitation: "payload",
      },
      groupAlias: "Team Space",
    });

    expect(await screen.findByText("Workspace created!")).toBeInTheDocument();
    expect(
      screen.getByText(/share an invitation now and create your first channel/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Workspace ID: group-1")).toBeInTheDocument();
  });
});
