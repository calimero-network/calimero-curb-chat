import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchChannelsContainer from "./SearchChannelsContainer";

const {
  mockListGroupContexts,
  mockUseCurrentGroupPermissions,
} = vi.hoisted(() => ({
  mockListGroupContexts: vi.fn(),
  mockUseCurrentGroupPermissions: vi.fn(),
}));

vi.mock("@calimero-network/mero-ui", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  SearchInput: ({
    label,
    onChange,
    value,
  }: {
    label: string;
    onChange: (value: string) => void;
    value: string;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  ),
}));

vi.mock("../../constants/config", () => ({
  getGroupId: () => "group-1",
}));

vi.mock("../../hooks/useCurrentGroupPermissions", () => ({
  useCurrentGroupPermissions: mockUseCurrentGroupPermissions,
}));

vi.mock("../../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {
    listGroupContexts = mockListGroupContexts;
  },
}));

vi.mock("../../api/dataSource/clientApiDataSource", () => ({
  ClientApiDataSource: class MockClientApiDataSource {},
}));

vi.mock("@calimero-network/calimero-client", () => ({
  apiClient: {
    node: () => ({
      fetchContextIdentities: vi.fn(),
    }),
  },
}));

describe("SearchChannelsContainer", () => {
  beforeEach(() => {
    mockListGroupContexts.mockReset();
    mockUseCurrentGroupPermissions.mockReset();

    mockListGroupContexts.mockResolvedValue({
      data: [],
    });
    mockUseCurrentGroupPermissions.mockReturnValue({
      isAdmin: false,
      canJoinOpenContexts: false,
      memberIdentity: "member-1",
    });
  });

  it("shows a first-class empty state when the workspace has no channels", async () => {
    render(
      <SearchChannelsContainer
        onChatSelected={vi.fn()}
        fetchChannels={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockListGroupContexts).toHaveBeenCalledWith("group-1");
    });

    expect(await screen.findByText(/no channels yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/create your first channel from the channels panel/i),
    ).toBeInTheDocument();
  });
});
