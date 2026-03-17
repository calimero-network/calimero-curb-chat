import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsTab from "./SettingsTab";

describe("SettingsTab", () => {
  it("edits default capabilities through the three permission toggles", async () => {
    const onSetDefaultCapabilities = vi.fn().mockResolvedValue(true);

    render(
      <SettingsTab
        groupId="group-1"
        group={{
          groupId: "group-1",
          appKey: "app-key",
          targetApplicationId: "target-app",
          upgradePolicy: "LazyOnAccess",
          memberCount: 2,
          contextCount: 1,
          activeUpgrade: null,
          defaultCapabilities: 2,
          defaultVisibility: "open",
        }}
        actionLoading={false}
        onSetDefaultCapabilities={onSetDefaultCapabilities}
        onSetDefaultVisibility={vi.fn().mockResolvedValue(true)}
      />,
    );

    const createChannels = screen.getByLabelText(/create channels/i);
    const inviteMembers = screen.getByLabelText(/invite members/i);
    const joinOpenChannels = screen.getByLabelText(/join open channels/i);

    expect(createChannels).not.toBeChecked();
    expect(inviteMembers).toBeChecked();
    expect(joinOpenChannels).not.toBeChecked();

    fireEvent.click(createChannels);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSetDefaultCapabilities).toHaveBeenCalledWith("group-1", 3);
  });
});
