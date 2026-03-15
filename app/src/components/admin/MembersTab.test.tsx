import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MembersTab from "./MembersTab";

vi.mock("@calimero-network/mero-ui", () => ({
  Avatar: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock("../popups/ConfirmPopup", () => ({
  default: ({ toggle }: { toggle: React.ReactNode }) => <>{toggle}</>,
}));

describe("MembersTab", () => {
  it("does not show the capabilities action for admin members", () => {
    render(
      <MembersTab
        groupId="group-1"
        members={[{ identity: "admin-identity", role: "Admin" }]}
        actionLoading={false}
        onRemoveMember={vi.fn().mockResolvedValue(true)}
        onSetCapabilities={vi.fn().mockResolvedValue(true)}
        onGetCapabilities={vi.fn().mockResolvedValue({ capabilities: 7 })}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /capabilities/i }),
    ).not.toBeInTheDocument();
  });
});
