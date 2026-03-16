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
    title,
  }: {
    toggle: React.ReactNode;
    isOpen: boolean;
    onConfirm: () => void;
    title: string;
  }) => (
    <div>
      {toggle}
      {isOpen ? <button onClick={onConfirm}>Confirm {title}</button> : null}
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
          info: null,
          otherIdentity: "user-2",
          otherAlias: "",
          otherUsername: "Jane",
          contextIdentity: "identity-1",
          myIdentity: "identity-1",
          isJoined: true,
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

  it("falls back to the participant identity when no DM profile username exists", () => {
    render(
      <UserItem
        dm={{
          contextId: "dm-2",
          info: null,
          otherIdentity: "user-2",
          otherAlias: "",
          otherUsername: "",
          contextIdentity: "identity-1",
          myIdentity: "identity-1",
          isJoined: true,
        }}
        onDMSelected={vi.fn()}
        onNoActiveChat={vi.fn()}
        selected={false}
      />,
    );

    expect(screen.getAllByText("user-2")).toHaveLength(2);
  });

  it("prefers the member alias when no DM profile username exists", () => {
    render(
      <UserItem
        dm={{
          contextId: "dm-4",
          info: null,
          otherIdentity: "user-4",
          otherAlias: "Taylor",
          otherUsername: "",
          contextIdentity: "identity-1",
          myIdentity: "identity-1",
          isJoined: true,
        }}
        onDMSelected={vi.fn()}
        onNoActiveChat={vi.fn()}
        selected={false}
      />,
    );

    expect(screen.getAllByText("Taylor")).toHaveLength(2);
  });

  it("asks for confirmation before joining an unjoined DM", () => {
    const onDMSelected = vi.fn();

    render(
      <UserItem
        dm={{
          contextId: "dm-3",
          info: null,
          otherIdentity: "user-3",
          otherAlias: "",
          otherUsername: "Sam",
          contextIdentity: undefined,
          myIdentity: "",
          isJoined: false,
        }}
        onDMSelected={onDMSelected}
        onNoActiveChat={vi.fn()}
        selected={false}
      />,
    );

    fireEvent.click(screen.getAllByText("Sam")[0]);

    expect(onDMSelected).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm Join DM")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Confirm Join DM"));

    expect(onDMSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        contextId: "dm-3",
      }),
    );
  });
});
