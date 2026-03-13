const CHAT_PROFILE_CACHE_KEY = "calimero_chat_profile_cache";

function readChatProfileCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CHAT_PROFILE_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeChatProfileCache(cache: Record<string, string>): void {
  localStorage.setItem(CHAT_PROFILE_CACHE_KEY, JSON.stringify(cache));
}

export function getCachedUsernameForIdentity(identity: string): string {
  if (!identity) {
    return "";
  }

  return readChatProfileCache()[identity] || "";
}

export function setCachedUsernameForIdentity(
  identity: string,
  username: string,
): void {
  if (!identity || !username.trim()) {
    return;
  }

  const cache = readChatProfileCache();
  cache[identity] = username.trim();
  writeChatProfileCache(cache);
}
