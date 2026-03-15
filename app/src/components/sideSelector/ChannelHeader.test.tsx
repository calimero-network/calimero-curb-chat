import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChannelHeader from "./ChannelHeader";

const { mockGetGroupId, mockUseCurrentGroupPermissions } = vi.hoisted(() => ({
  mockGetGroupId: vi.fn(),
  mockUseCurrentGroupPermissions: vi.fn(),
}));

vi.mock("../../constants/config", () => ({
  getGroupId: mockGetGroupId,
  getApplicationId: () => "app-id",
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
  ContextApiDataSource: class MockContextApiDataSource {},
}));

vi.mock("../../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {},
}));

vi.mock("../popups/CreateChannelPopup", () => ({
  default: ({
    toggle,
  }: {
    toggle: React.ReactNode;
  }) => <div data-testid="create-channel-toggle">{toggle}</div>,
}));

describe("ChannelHeader", () => {
  beforeEach(() => {
    mockGetGroupId.mockReset();
    mockUseCurrentGroupPermissions.mockReset();
    mockGetGroupId.mockReturnValue("group-1");
  });

  it("hides the create channel action for members without create-context permission", () => {
    mockUseCurrentGroupPermissions.mockReturnValue({
      loading: false,
      isAdmin: false,
      canCreateContext: false,
    });

    render(<ChannelHeader title="Channels" />);

    expect(screen.queryByTestId("create-channel-toggle")).not.toBeInTheDocument();
  });
});
