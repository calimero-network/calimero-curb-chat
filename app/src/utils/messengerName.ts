import { StorageHelper } from "./storage";

const MESSENGER_NAME_KEY = "chat-username";

export function getMessengerDisplayName(): string {
  return (StorageHelper.getItem(MESSENGER_NAME_KEY) || "").trim();
}

export function clearMessengerDisplayName(): void {
  StorageHelper.removeItem(MESSENGER_NAME_KEY);
}

export function setMessengerDisplayName(name: string): void {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  StorageHelper.setItem(MESSENGER_NAME_KEY, trimmedName);
}
