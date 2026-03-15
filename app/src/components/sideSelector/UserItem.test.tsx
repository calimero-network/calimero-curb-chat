import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserItem from "./UserItem";

const {
  mockDeleteContext,
  mockAddToast,
} = vi.hoisted(() => ({
  mockDeleteContext: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock("@calimero-network/mero-ui", () => ({
  Avatar: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock("../../api/dataSource/nodeApiDataSource", () => ({
  ContextApiDataSource: class MockContextApiDataSource {
    deleteContext = mockDeleteContext;
  },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

vi.mock("../popups/ConfirmPopup", () => ({
  default: ({
    toggle,
    isOpen,
    onConfirm,
  }: {
    toggle: React.ReactNode;
    isOpen: boolean;
    onConfirm: () => void;
  }) => (
    <div>
      {toggle}
      {isOpen ? <button onClick={onConfirm}>Confirm delete</button> : null}
    </div>
  ),
}));

describe("UserItem", () => {
  beforeEach(() => {
    mockDeleteContext.mockReset();
    mockAddToast.mockReset();

    mockDeleteContext.mockResolvedValue({
      data: {
        success: true,
      },
    });
  });

  it("returns to the no-active-chat state after deleting a DM", async () => {
    const onNoActiveChat = vi.fn();

    render(
      <UserItem
        dm={{
          contextId: "dm-1",
          otherParticipant: "user-2",
          otherUsername: "Jane",
          contextIdentity: "identity-1",
        }}
        onDMSelected={vi.fn()}
        onNoActiveChat={onNoActiveChat}
        selected={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete dm/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => {
      expect(mockDeleteContext).toHaveBeenCalledWith({ contextId: "dm-1" });
    });

    expect(onNoActiveChat).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "DM deleted",
      }),
    );
  });
});
