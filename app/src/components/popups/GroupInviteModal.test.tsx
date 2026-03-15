import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GroupInviteModal from "./GroupInviteModal";

vi.mock("@calimero-network/mero-ui", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("../../api/dataSource/groupApiDataSource", () => ({
  GroupApiDataSource: class MockGroupApiDataSource {},
}));

vi.mock("../../utils/invitation", () => ({
  generateInvitationDeepLink: (payload: string) => `desktop:${payload}`,
  generateInvitationUrl: (payload: string) => `https://example.com/${payload}`,
  serializeGroupInvitationPayload: vi.fn(),
}));

describe("GroupInviteModal", () => {
  it("shows the returned group id as the workspace id", () => {
    render(
      <GroupInviteModal
        groupId="12738d49b49b73f5fa471deb839a70c8a939778d3c0e5a2171203f965232a4a4"
        isOpen={true}
        onClose={vi.fn()}
        initialInvitationPayload="invite-payload"
      />,
    );

    expect(screen.getByText(/workspace id/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        "12738d49b49b73f5fa471deb839a70c8a939778d3c0e5a2171203f965232a4a4",
      ),
    ).toBeInTheDocument();
  });
});
