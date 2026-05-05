import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsTab from "./SettingsTab";

const baseGroup = {
  groupId: "group-abc-123",
  appKey: "app-key",
  targetApplicationId: "target-app-id",
  upgradePolicy: "LazyOnAccess",
  memberCount: 5,
  contextCount: 3,
  activeUpgrade: null,
  defaultCapabilities: 2,
  subgroupVisibility: "open" as const,
};

describe("SettingsTab", () => {
  it("renders group info fields", () => {
    render(
      <SettingsTab
        groupId="group-abc-123"
        group={baseGroup}
        actionLoading={false}
        onSetDefaultCapabilities={vi.fn()}
        onSetSubgroupVisibility={vi.fn()}
      />,
    );

    expect(screen.getByText(/group info/i)).toBeInTheDocument();
    expect(screen.getByText("group-abc-123")).toBeInTheDocument();
    expect(screen.getByText("target-app-id")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("LazyOnAccess")).toBeInTheDocument();
  });

  it("shows empty state when group is null", () => {
    render(
      <SettingsTab
        groupId="group-abc-123"
        group={null}
        actionLoading={false}
        onSetDefaultCapabilities={vi.fn()}
        onSetSubgroupVisibility={vi.fn()}
      />,
    );

    expect(screen.getByText(/no group data available/i)).toBeInTheDocument();
  });
});
