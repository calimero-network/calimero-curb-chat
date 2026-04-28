import type { VisibilityMode } from "../api/groupApi";

export type ChannelVisibilityOption = "public" | "private";
export type ChannelVisibilityLabel = "Open" | "Restricted";

export function getChannelVisibilityOption(
  defaultVisibility: VisibilityMode,
): ChannelVisibilityOption {
  return defaultVisibility === "restricted" ? "private" : "public";
}

export function getContextVisibilityModeFromOption(
  visibility: ChannelVisibilityOption,
): VisibilityMode {
  return visibility === "private" ? "restricted" : "open";
}

export function getChannelVisibilityOptionLabel(
  visibility: ChannelVisibilityOption,
): ChannelVisibilityLabel {
  return visibility === "private" ? "Restricted" : "Open";
}

export function getContextVisibilityLabel(
  visibility: VisibilityMode,
): ChannelVisibilityLabel {
  return visibility === "restricted" ? "Restricted" : "Open";
}

export function isRestrictedChannelType(channelType?: string): boolean {
  return channelType === "Restricted" || channelType === "Private";
}
