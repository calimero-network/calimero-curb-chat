import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPopup from "./SettingsPopup";

const {
  mockLogout,
  mockClearStoredSession,
  mockClearSessionActivity,
  mockClearWorkspaceSelection,
  mockNavigate,
} = vi.hoisted(() => ({
  mockLogout: vi.fn(),
  mockClearStoredSession: vi.fn(),
  mockClearSessionActivity: vi.fn(),
  mockClearWorkspaceSelection: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@calimero-network/calimero-client", () => ({
  useCalimero: () => ({
    logout: mockLogout,
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../utils/session", () => ({
  clearStoredSession: mockClearStoredSession,
  clearSessionActivity: mockClearSessionActivity,
}));

vi.mock("../../constants/config", () => ({
  clearWorkspaceSelection: mockClearWorkspaceSelection,
}));

vi.mock("../common/popups/BaseModal", () => ({
  default: ({
    content,
    open,
  }: {
    content: React.ReactNode;
    open: boolean;
  }) => (open ? <div>{content}</div> : null),
}));

vi.mock("../contextOperations/TabbedInterface", () => ({
  default: () => <div>Tabbed Interface</div>,
}));

describe("SettingsPopup", () => {
  beforeEach(() => {
    mockLogout.mockReset();
    mockClearStoredSession.mockReset();
    mockClearSessionActivity.mockReset();
    mockClearWorkspaceSelection.mockReset();
    mockNavigate.mockReset();
    sessionStorage.clear();
  });

  it("shows separate actions for changing workspace and full logout", () => {
    render(
      <SettingsPopup
        isOpen={true}
        setIsOpen={vi.fn()}
        toggle={<button>Open</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: /change workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^logout$/i })).toBeInTheDocument();
  });

  it("changes workspace without performing a full logout", () => {
    sessionStorage.setItem("curb_is_context_owner", "true");
    const setIsOpen = vi.fn();

    render(
      <SettingsPopup
        isOpen={true}
        setIsOpen={setIsOpen}
        toggle={<button>Open</button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /change workspace/i }));

    expect(mockClearStoredSession).toHaveBeenCalled();
    expect(mockClearSessionActivity).toHaveBeenCalled();
    expect(mockClearWorkspaceSelection).toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it("keeps full logout behavior on the logout action", () => {
    const setIsOpen = vi.fn();

    render(
      <SettingsPopup
        isOpen={true}
        setIsOpen={setIsOpen}
        toggle={<button>Open</button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^logout$/i }));

    expect(mockClearStoredSession).toHaveBeenCalled();
    expect(mockClearSessionActivity).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });
});
