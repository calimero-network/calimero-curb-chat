import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import { WebSocketProvider, useWebSocket, useWebSocketEvents } from "./WebSocketContext";
import type { WebSocketEvent } from "../types/WebSocketTypes";

// ── Hoisted mocks (must be defined before vi.mock factories are evaluated) ────

const mockSubscription = vi.hoisted(() => ({
  subscribeToContexts: vi.fn(),
  subscribeToContext: vi.fn(),
  unsubscribeFromContext: vi.fn(),
  unsubscribeAll: vi.fn(),
  getSubscribedContexts: vi.fn().mockReturnValue([]),
  isSubscribed: vi.fn().mockReturnValue(false),
  getSubscriptionCount: vi.fn().mockReturnValue(0),
}));

// Capture the event-callback passed to useSseSubscription so tests
// can fire events through it directly.
let capturedEventCallback: ((event: WebSocketEvent) => Promise<void>) | null = null;

vi.mock("../hooks/useSseSubscription", () => ({
  useSseSubscription: vi.fn((callback: unknown) => {
    capturedEventCallback = callback as (event: WebSocketEvent) => Promise<void>;
    return mockSubscription;
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  capturedEventCallback = null;
  mockSubscription.getSubscribedContexts.mockReturnValue([]);
  mockSubscription.isSubscribed.mockReturnValue(false);
  mockSubscription.getSubscriptionCount.mockReturnValue(0);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return <WebSocketProvider>{children}</WebSocketProvider>;
}

function makeEvent(contextId = "ctx-1"): WebSocketEvent {
  return {
    contextId,
    type: "StateMutation",
    data: { events: [{ kind: "MessageSent" }] },
  };
}

async function fireEvent(event: WebSocketEvent) {
  if (!capturedEventCallback) throw new Error("eventCallback not captured");
  await act(() => capturedEventCallback!(event));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WebSocketProvider", () => {
  it("renders children without throwing", () => {
    const { getByText } = render(
      <WebSocketProvider>
        <span>child</span>
      </WebSocketProvider>,
    );
    expect(getByText("child")).toBeTruthy();
  });

  it("exposes subscription methods via useWebSocket", () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    expect(result.current.subscribeToContexts).toBe(mockSubscription.subscribeToContexts);
    expect(result.current.subscribeToContext).toBe(mockSubscription.subscribeToContext);
    expect(result.current.unsubscribeFromContext).toBe(mockSubscription.unsubscribeFromContext);
    expect(result.current.unsubscribeAll).toBe(mockSubscription.unsubscribeAll);
  });
});

describe("useWebSocket", () => {
  it("throws when used outside WebSocketProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWebSocket())).toThrow(
      "useWebSocket must be used within WebSocketProvider",
    );
    spy.mockRestore();
  });
});

describe("addEventListener / removeEventListener", () => {
  it("dispatches events to a registered listener", async () => {
    const listener = vi.fn();
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    act(() => result.current.addEventListener(listener));
    await fireEvent(makeEvent());

    expect(listener).toHaveBeenCalledWith(makeEvent());
  });

  it("dispatches to multiple listeners independently", async () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    act(() => {
      result.current.addEventListener(l1);
      result.current.addEventListener(l2);
    });
    await fireEvent(makeEvent("ctx-2"));

    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  it("does not call a listener after removeEventListener", async () => {
    const listener = vi.fn();
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    act(() => result.current.addEventListener(listener));
    act(() => result.current.removeEventListener(listener));
    await fireEvent(makeEvent());

    expect(listener).not.toHaveBeenCalled();
  });

  it("an error in one listener does not prevent others from being called", async () => {
    const badListener = vi.fn().mockImplementation(() => {
      throw new Error("listener crashed");
    });
    const goodListener = vi.fn();
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    act(() => {
      result.current.addEventListener(badListener);
      result.current.addEventListener(goodListener);
    });
    // Should not throw despite the bad listener
    await fireEvent(makeEvent());

    expect(goodListener).toHaveBeenCalledTimes(1);
  });
});

describe("useWebSocketEvents", () => {
  it("registers listener and receives events", async () => {
    const listener = vi.fn();
    renderHook(() => useWebSocketEvents(listener), { wrapper });

    await fireEvent(makeEvent());

    expect(listener).toHaveBeenCalledWith(makeEvent());
  });

  it("removes listener on unmount", async () => {
    const listener = vi.fn();
    const { unmount } = renderHook(() => useWebSocketEvents(listener), { wrapper });

    unmount();
    await fireEvent(makeEvent());

    expect(listener).not.toHaveBeenCalled();
  });

  it("uses the latest listener reference when callback prop changes", async () => {
    const first = vi.fn();
    const second = vi.fn();
    let active = first;

    const { rerender } = renderHook(() => useWebSocketEvents(active), { wrapper });

    active = second;
    rerender();
    await fireEvent(makeEvent());

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
