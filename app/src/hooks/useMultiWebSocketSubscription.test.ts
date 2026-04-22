import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMultiWebSocketSubscription } from "./useMultiWebSocketSubscription";
import type { CalimeroApp } from "@calimero-network/calimero-client";

function makeApp() {
  return {
    subscribeToEvents: vi.fn(),
    unsubscribeFromEvents: vi.fn(),
  } as unknown as CalimeroApp;
}

const mockCallback = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMultiWebSocketSubscription", () => {
  // ── subscribeToContexts ────────────────────────────────────────────────────

  it("subscribeToContexts calls subscribeToEvents for new context IDs", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1", "ctx-2"]));

    expect(app.subscribeToEvents).toHaveBeenCalledWith(
      ["ctx-1", "ctx-2"],
      mockCallback,
    );
    expect(result.current.getSubscriptionCount()).toBe(2);
  });

  it("subscribeToContexts skips already-subscribed contexts (dedup)", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1"]));
    act(() => result.current.subscribeToContexts(["ctx-1", "ctx-2"]));

    // Second call should only subscribe the new one
    expect(app.subscribeToEvents).toHaveBeenCalledTimes(2);
    expect(app.subscribeToEvents).toHaveBeenLastCalledWith(
      ["ctx-2"],
      mockCallback,
    );
    expect(result.current.getSubscriptionCount()).toBe(2);
  });

  it("subscribeToContexts unsubscribes contexts removed from the list", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1", "ctx-2"]));
    act(() => result.current.subscribeToContexts(["ctx-2"]));

    expect(app.unsubscribeFromEvents).toHaveBeenCalledWith(["ctx-1"]);
    expect(result.current.getSubscriptionCount()).toBe(1);
    expect(result.current.getSubscribedContexts()).toEqual(["ctx-2"]);
  });

  it("subscribeToContexts filters out empty / whitespace-only IDs", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["", "  ", "ctx-1"]));

    expect(app.subscribeToEvents).toHaveBeenCalledWith(["ctx-1"], mockCallback);
    expect(result.current.getSubscriptionCount()).toBe(1);
  });

  it("subscribeToContexts is a no-op when app is null", () => {
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(null, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1"]));

    expect(result.current.getSubscriptionCount()).toBe(0);
  });

  it("subscribeToContexts is a no-op when callback is null", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, null),
    );

    act(() => result.current.subscribeToContexts(["ctx-1"]));

    expect(app.subscribeToEvents).not.toHaveBeenCalled();
  });

  // ── subscribeToContext ─────────────────────────────────────────────────────

  it("subscribeToContext adds a single new context", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContext("ctx-A"));

    expect(app.subscribeToEvents).toHaveBeenCalledWith(["ctx-A"], mockCallback);
    expect(result.current.isSubscribed()).toBe(true);
  });

  it("subscribeToContext is a no-op for already-subscribed context", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContext("ctx-A"));
    act(() => result.current.subscribeToContext("ctx-A"));

    expect(app.subscribeToEvents).toHaveBeenCalledTimes(1);
    expect(result.current.getSubscriptionCount()).toBe(1);
  });

  // ── unsubscribeFromContext ─────────────────────────────────────────────────

  it("unsubscribeFromContext removes the specific context", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1", "ctx-2"]));
    act(() => result.current.unsubscribeFromContext("ctx-1"));

    expect(app.unsubscribeFromEvents).toHaveBeenCalledWith(["ctx-1"]);
    expect(result.current.getSubscriptionCount()).toBe(1);
    expect(result.current.getSubscribedContexts()).toEqual(["ctx-2"]);
  });

  it("unsubscribeFromContext is a no-op for unknown context", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.unsubscribeFromContext("unknown"));

    expect(app.unsubscribeFromEvents).not.toHaveBeenCalled();
  });

  // ── unsubscribeAll ────────────────────────────────────────────────────────

  it("unsubscribeAll removes every subscribed context", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1", "ctx-2", "ctx-3"]));
    act(() => result.current.unsubscribeAll());

    expect(app.unsubscribeFromEvents).toHaveBeenCalledWith(
      expect.arrayContaining(["ctx-1", "ctx-2", "ctx-3"]),
    );
    expect(result.current.getSubscriptionCount()).toBe(0);
    expect(result.current.isSubscribed()).toBe(false);
  });

  it("unsubscribeAll is a no-op when nothing is subscribed", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.unsubscribeAll());

    expect(app.unsubscribeFromEvents).not.toHaveBeenCalled();
  });

  // ── getSubscribedContexts / isSubscribed / getSubscriptionCount ────────────

  it("getSubscribedContexts returns the current list", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1", "ctx-2"]));

    expect(result.current.getSubscribedContexts()).toEqual(
      expect.arrayContaining(["ctx-1", "ctx-2"]),
    );
  });

  it("isSubscribed returns false initially", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    expect(result.current.isSubscribed()).toBe(false);
  });

  it("isSubscribed returns true after subscribing", () => {
    const app = makeApp();
    const { result } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContext("ctx-1"));

    expect(result.current.isSubscribed()).toBe(true);
  });

  // ── cleanup on unmount ─────────────────────────────────────────────────────

  it("unsubscribes from all contexts when the component unmounts", () => {
    const app = makeApp();
    const { result, unmount } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    act(() => result.current.subscribeToContexts(["ctx-1", "ctx-2"]));
    unmount();

    expect(app.unsubscribeFromEvents).toHaveBeenCalledWith(
      expect.arrayContaining(["ctx-1", "ctx-2"]),
    );
  });

  it("does not call unsubscribeFromEvents on unmount if nothing was subscribed", () => {
    const app = makeApp();
    const { unmount } = renderHook(() =>
      useMultiWebSocketSubscription(app, mockCallback),
    );

    unmount();

    expect(app.unsubscribeFromEvents).not.toHaveBeenCalled();
  });
});
