import { StorageHelper } from "./storage";

const MESSENGER_NAME_KEY = "chat-username";
const IDENTITY_NAME_PREFIX = "curb_username_";
// calimero-client stores the executor's public key under this key
const CONTEXT_IDENTITY_KEY = "context-identity";

/** Returns the stored executor public key (set by calimero-client's setExecutorPublicKey). */
export function getStoredExecutorIdentity(): string {
  try {
    const raw = StorageHelper.getItem(CONTEXT_IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as string) : "";
  } catch {
    return "";
  }
}

export function getMessengerDisplayName(): string {
  return (StorageHelper.getItem(MESSENGER_NAME_KEY) || "").trim();
}

export function clearMessengerDisplayName(): void {
  StorageHelper.removeItem(MESSENGER_NAME_KEY);
}

export function setMessengerDisplayName(name: string): void {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  StorageHelper.setItem(MESSENGER_NAME_KEY, trimmedName);
}

/** Per-identity display name — keyed by the member's public key, stable across workspaces. */
export function getIdentityDisplayName(memberIdentity: string): string {
  if (!memberIdentity) return "";
  return (StorageHelper.getItem(IDENTITY_NAME_PREFIX + memberIdentity) || "").trim();
}

export function setIdentityDisplayName(memberIdentity: string, name: string): void {
  if (!memberIdentity) return;
  const trimmedName = name.trim();
  if (!trimmedName) return;
  StorageHelper.setItem(IDENTITY_NAME_PREFIX + memberIdentity, trimmedName);
}

export function clearIdentityDisplayName(memberIdentity: string): void {
  if (!memberIdentity) return;
  StorageHelper.removeItem(IDENTITY_NAME_PREFIX + memberIdentity);
}
