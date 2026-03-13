export const CAN_CREATE_CONTEXT = 1 << 0;
export const CAN_INVITE_MEMBERS = 1 << 1;
export const CAN_JOIN_OPEN_CONTEXTS = 1 << 2;

export function hasGroupCapability(
  capabilities: number | null | undefined,
  capability: number,
): boolean {
  return typeof capabilities === "number" && (capabilities & capability) === capability;
}

export function canInviteWorkspaceMembers(
  capabilities: number | null | undefined,
): boolean {
  return hasGroupCapability(capabilities, CAN_INVITE_MEMBERS);
}

export function canJoinOpenGroupContexts(
  capabilities: number | null | undefined,
): boolean {
  return hasGroupCapability(capabilities, CAN_JOIN_OPEN_CONTEXTS);
}
