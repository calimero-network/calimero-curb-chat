import type { ActiveChat } from "../types/Common";

export type AppEntryState =
  | "login"
  | "browse-channels"
  | "complete-profile"
  | "chat";

export function getAppEntryState(params: {
  isAuthenticated: boolean;
  isConfigSet: boolean;
  groupId: string;
  activeChat: ActiveChat | null;
}): AppEntryState {
  const { isAuthenticated, isConfigSet, groupId, activeChat } = params;

  if (!isAuthenticated || !isConfigSet || !groupId) {
    return "login";
  }

  if (!activeChat) {
    return "browse-channels";
  }

  if (activeChat.requiresProfileSetup) {
    return "complete-profile";
  }

  return "chat";
}
