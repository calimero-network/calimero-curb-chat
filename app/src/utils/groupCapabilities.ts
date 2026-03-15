export const CAN_CREATE_CONTEXT = 1 << 0;
export const CAN_INVITE_MEMBERS = 1 << 1;
export const CAN_JOIN_OPEN_CONTEXTS = 1 << 2;

export interface GroupCapabilityToggles {
  canCreateContext: boolean;
  canInviteMembers: boolean;
  canJoinOpenContexts: boolean;
}

export function hasGroupCapability(
  capabilities: number | null | undefined,
  capability: number,
): boolean {
  return typeof capabilities === "number" && (capabilities & capability) === capability;
}

export function buildGroupCapabilitiesMask(
  toggles: GroupCapabilityToggles,
): number {
  let mask = 0;

  if (toggles.canCreateContext) {
    mask |= CAN_CREATE_CONTEXT;
  }

  if (toggles.canInviteMembers) {
    mask |= CAN_INVITE_MEMBERS;
  }

  if (toggles.canJoinOpenContexts) {
    mask |= CAN_JOIN_OPEN_CONTEXTS;
  }

  return mask;
}

export function readGroupCapabilitiesMask(
  capabilities: number | null | undefined,
): GroupCapabilityToggles {
  return {
    canCreateContext: hasGroupCapability(capabilities, CAN_CREATE_CONTEXT),
    canInviteMembers: hasGroupCapability(capabilities, CAN_INVITE_MEMBERS),
    canJoinOpenContexts: hasGroupCapability(capabilities, CAN_JOIN_OPEN_CONTEXTS),
  };
}

export function canInviteWorkspaceMembers(
  capabilities: number | null | undefined,
): boolean {
  return hasGroupCapability(capabilities, CAN_INVITE_MEMBERS);
}

export function canCreateGroupContexts(
  capabilities: number | null | undefined,
): boolean {
  return hasGroupCapability(capabilities, CAN_CREATE_CONTEXT);
}

export function canJoinOpenGroupContexts(
  capabilities: number | null | undefined,
): boolean {
  return hasGroupCapability(capabilities, CAN_JOIN_OPEN_CONTEXTS);
}
