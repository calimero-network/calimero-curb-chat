import { describe, expect, it } from "vitest";
import {
  CAN_CREATE_CONTEXT,
  CAN_INVITE_MEMBERS,
  CAN_JOIN_OPEN_CONTEXTS,
  buildGroupCapabilitiesMask,
  canCreateGroupContexts,
  readGroupCapabilitiesMask,
} from "./groupCapabilities";

describe("groupCapabilities", () => {
  it("builds a bitmask from the three capability toggles", () => {
    expect(
      buildGroupCapabilitiesMask({
        canCreateContext: true,
        canInviteMembers: false,
        canJoinOpenContexts: true,
      }),
    ).toBe(CAN_CREATE_CONTEXT + CAN_JOIN_OPEN_CONTEXTS);
  });

  it("reads the three toggle states from a bitmask", () => {
    expect(
      readGroupCapabilitiesMask(CAN_INVITE_MEMBERS + CAN_JOIN_OPEN_CONTEXTS),
    ).toEqual({
      canCreateContext: false,
      canInviteMembers: true,
      canJoinOpenContexts: true,
    });
  });

  it("detects create-context permission from the bitmask", () => {
    expect(canCreateGroupContexts(CAN_CREATE_CONTEXT)).toBe(true);
    expect(canCreateGroupContexts(CAN_INVITE_MEMBERS)).toBe(false);
  });
});
