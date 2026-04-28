import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChannelList from "./ChannelList";

const { mockBuildChannelEntryChat } = vi.hoisted(() => ({
  mockBuildChannelEntryChat: vi.fn((params) => ({
    type: "channel",
    id: params.contextId,
    contextId: params.contextId,
    contextIdentity: params.contextIdentity,
    name: params.name,
  })),
}));

vi.mock("../../utils/channelEntry", () => ({
  buildChannelEntryChat: mockBuildChannelEntryChat,
}));

describe("ChannelList", () => {
  it("shows the alias in the sidebar while keeping channel selection names on the legacy fallback", () => {
    const selectChannel = vi.fn();

    render(
      <ChannelList
        channels={[
          {
            contextId: "abcdefgh12345678",
            alias: "Project Alpha",
            info: null,
            visibility: "open",
            contextIdentity: "member-key-1",
            isJoined: true,
          },
        ]}
        selectedChannelId=""
        selectChannel={selectChannel}
      />,
    );

    const channelRow = screen.getByText("Project Alpha");
    expect(channelRow).toBeInTheDocument();

    fireEvent.click(channelRow);

    expect(mockBuildChannelEntryChat).toHaveBeenCalledWith(
      expect.objectContaining({
        contextId: "abcdefgh12345678",
        name: "abcdefgh",
      }),
    );
  });
});
