import { describe, expect, it } from "vitest";
import { buildChannelEntryChat } from "./channelEntry";

describe("buildChannelEntryChat", () => {
  it("marks joined channels without a username as needing profile setup", () => {
    expect(
      buildChannelEntryChat({
        contextId: "context-1",
        name: "general",
        contextIdentity: "pk-1",
        username: "",
      }),
    ).toMatchObject({
      id: "context-1",
      contextId: "context-1",
      contextIdentity: "pk-1",
      canJoin: false,
      requiresProfileSetup: true,
    });
  });

  it("opens joined channels directly when a username already exists", () => {
    expect(
      buildChannelEntryChat({
        contextId: "context-1",
        name: "general",
        contextIdentity: "pk-1",
        username: "alice",
      }),
    ).toMatchObject({
      id: "context-1",
      contextId: "context-1",
      contextIdentity: "pk-1",
      canJoin: false,
      requiresProfileSetup: false,
    });
  });
});
