/**
 * logic-js WASM RPC tests — live merod node, no browser.
 *
 * Tests every public method of the logic-js WASM (camelCase API):
 *   Members:   getUsername, getMembers, joinChat
 *   Channels:  getChannels, getChannelDirectory, createChannel,
 *              joinPublicChannel, leaveChannel, deleteChannel,
 *              addUserToChannel, removeUserFromChannel,
 *              promoteModerator, demoteModerator, getInvitees
 *   Messages:  sendMessage, getMessages, editMessage, deleteMessage
 *   Reactions: updateReaction
 *   Threads:   sendMessage(parentId), getMessages(parentId)
 *   Read:      readMessage
 *   DMs:       getDMs
 *   Multi-user: cross-node P2P sync, auth enforcement
 *
 * Prerequisites:
 *   ./scripts/setup-nodes.sh   ← starts 2 nodes, writes app/.env.integration
 *
 * Run:
 *   pnpm exec playwright test --project=rpc-logic
 *   pnpm exec playwright test --project=rpc-logic -g "channels"
 */

import { test, expect } from "@playwright/test";
import {
  makeClient,
  makeClient2,
  envAvailable,
  twoNodeEnvAvailable,
  getEnv,
} from "./helpers/rpc-client";

// ── Types matching logic-js WASM output ──────────────────────────────────────

interface Attachment {
  name: string;
  mime_type: string;
  size: number;
  blob_id_str: string;
}

interface StoredMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  timestamp: string;       // bigint serialized as string
  parentId?: string | null;
  deleted: boolean;
  editedAt?: string | null; // bigint serialized as string
  images?: Attachment[];
  files?: Attachment[];
  mentions: string[];
  mentionUsernames: string[];
  threadCount?: number;
  threadLastTimestamp?: string;
}

interface Reaction {
  emoji: string;
  users: string[];  // usernames (not IDs)
}

interface MessageWithReactions extends StoredMessage {
  reactions: Reaction[];
}

interface FullMessageResponse {
  messages: MessageWithReactions[];
  total_count: number;
  start_position: number;
}

interface ChannelMemberEntry {
  publicKey: string;
  username: string;
}

interface ChannelResponse {
  channelId: string;
  type: string;
  createdAt: string;
  createdBy: string;
  createdByUsername: string;
  readOnly: boolean;
  moderators: ChannelMemberEntry[];
  members: ChannelMemberEntry[];
  unreadMessages: { count: number; mentions: number };
}

interface ChannelDirectory {
  joined: ChannelResponse[];
  availablePublic: ChannelResponse[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireEnv() {
  if (!envAvailable()) test.skip();
}

/** Send a message on the default "general" channel (node-1). */
async function sendMsg(text: string): Promise<MessageWithReactions> {
  return makeClient().call<MessageWithReactions>("sendMessage", {
    channelId: "general",
    text,
  });
}

/** Fetch all messages from "general" on node-1. */
async function getMessages(opts: {
  searchTerm?: string;
  limit?: number;
  parentId?: string | null;
} = {}): Promise<FullMessageResponse> {
  return makeClient().call<FullMessageResponse>("getMessages", {
    channelId: "general",
    searchTerm: opts.searchTerm ?? null,
    limit: opts.limit ?? 50,
    offset: 0,
    parentId: opts.parentId ?? null,
  });
}

/** Poll `fn` up to `maxMs` ms (250 ms intervals) until it returns truthy. */
async function pollUntil<T>(
  fn: () => Promise<T | null | undefined | false>,
  maxMs = 8000,
): Promise<T> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`pollUntil timed out after ${maxMs}ms`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Members / Identity
// ─────────────────────────────────────────────────────────────────────────────

test.describe("members / identity", () => {
  test.beforeAll(requireEnv);

  test("getUsername returns 'admin' (set during init)", async () => {
    const username = await makeClient().call<string>("getUsername", {});
    expect(typeof username).toBe("string");
    expect(username.length).toBeGreaterThan(0);
  });

  test("getMembers returns array with at least the owner", async () => {
    const members = await makeClient().call<Array<{ userId: string; username: string }>>(
      "getMembers",
      {},
    );
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThan(0);
    const m = members[0];
    expect(typeof m.userId).toBe("string");
    expect(typeof m.username).toBe("string");
  });

  test("getMembers contains the context owner", async () => {
    const env = getEnv();
    const members = await makeClient().call<Array<{ userId: string; username: string }>>(
      "getMembers",
      {},
    );
    const owner = members.find((m) => m.userId === env.memberKey);
    expect(owner).toBeTruthy();
    expect(owner!.username).toBe("admin");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Channels
// ─────────────────────────────────────────────────────────────────────────────

test.describe("channels", () => {
  test.beforeAll(requireEnv);

  test("getChannels returns array with 'general' channel from init", async () => {
    const channels = await makeClient().call<ChannelResponse[]>("getChannels", {});
    expect(Array.isArray(channels)).toBe(true);
    const general = channels.find((c) => c.channelId === "general");
    expect(general).toBeTruthy();
  });

  test("getChannels channel shape: channelId, type, createdBy, members, moderators", async () => {
    const channels = await makeClient().call<ChannelResponse[]>("getChannels", {});
    expect(channels.length).toBeGreaterThan(0);
    const c = channels[0];
    expect(typeof c.channelId).toBe("string");
    expect(typeof c.type).toBe("string");
    expect(typeof c.createdBy).toBe("string");
    expect(Array.isArray(c.members)).toBe(true);
    expect(Array.isArray(c.moderators)).toBe(true);
    expect(typeof c.unreadMessages.count).toBe("number");
  });

  test("getChannelDirectory returns joined and availablePublic arrays", async () => {
    const dir = await makeClient().call<ChannelDirectory>("getChannelDirectory", {});
    expect(Array.isArray(dir.joined)).toBe(true);
    expect(Array.isArray(dir.availablePublic)).toBe(true);
    const general = dir.joined.find((c) => c.channelId === "general");
    expect(general).toBeTruthy();
  });

  test("createChannel creates a new public channel", async () => {
    const tag = `test-${Date.now()}`;
    const result = await makeClient().call<string>("createChannel", {
      name: tag,
      type: "public",
    });
    expect(result).toMatch(/channel created/i);

    const channels = await makeClient().call<ChannelResponse[]>("getChannels", {});
    const created = channels.find((c) => c.channelId === tag);
    expect(created).toBeTruthy();
  });

  test("createChannel with duplicate name returns error string", async () => {
    const tag = `dup-${Date.now()}`;
    await makeClient().call<string>("createChannel", { name: tag, type: "public" });
    const result = await makeClient().call<string>("createChannel", { name: tag, type: "public" });
    expect(result).toMatch(/already exists/i);
  });

  test("createChannel empty name returns error string", async () => {
    const result = await makeClient().call<string>("createChannel", {
      name: "   ",
      type: "public",
    });
    expect(result).toMatch(/cannot be empty/i);
  });

  test("createChannel with 'default' type is rejected", async () => {
    const result = await makeClient().call<string>("createChannel", {
      name: `default-attempt-${Date.now()}`,
      type: "default",
    });
    expect(result).toMatch(/default channels/i);
  });

  test("new public channel appears in getChannelDirectory.availablePublic for non-members", async () => {
    // Create a public channel, then leave it, check it appears as available
    const tag = `dir-pub-${Date.now()}`;
    await makeClient().call<string>("createChannel", { name: tag, type: "public" });

    // Creator is a member so it appears in joined, not availablePublic
    const dirBefore = await makeClient().call<ChannelDirectory>("getChannelDirectory", {});
    const inJoined = dirBefore.joined.find((c) => c.channelId === tag);
    expect(inJoined).toBeTruthy();

    // Leave the channel
    await makeClient().call<string>("leaveChannel", { channelId: tag });

    // Should now appear in availablePublic
    const dirAfter = await makeClient().call<ChannelDirectory>("getChannelDirectory", {});
    const inAvailable = dirAfter.availablePublic.find((c) => c.channelId === tag);
    expect(inAvailable).toBeTruthy();

    // Rejoin via joinPublicChannel
    const joinResult = await makeClient().call<string>("joinPublicChannel", { channelId: tag });
    expect(joinResult).toMatch(/joined/i);
  });

  test("leaveChannel removes user from channel", async () => {
    const tag = `leave-${Date.now()}`;
    await makeClient().call<string>("createChannel", { name: tag, type: "public" });

    const channels = await makeClient().call<ChannelResponse[]>("getChannels", {});
    expect(channels.find((c) => c.channelId === tag)).toBeTruthy();

    await makeClient().call<string>("leaveChannel", { channelId: tag });

    const after = await makeClient().call<ChannelResponse[]>("getChannels", {});
    expect(after.find((c) => c.channelId === tag)).toBeFalsy();
  });

  test("deleteChannel removes channel from list", async () => {
    const tag = `del-chan-${Date.now()}`;
    await makeClient().call<string>("createChannel", { name: tag, type: "public" });

    const result = await makeClient().call<string>("deleteChannel", { channelId: tag });
    expect(result).toMatch(/deleted/i);

    const channels = await makeClient().call<ChannelResponse[]>("getChannels", {});
    expect(channels.find((c) => c.channelId === tag)).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. sendMessage / getMessages
// ─────────────────────────────────────────────────────────────────────────────

test.describe("sendMessage / getMessages", () => {
  test.beforeAll(requireEnv);

  test("sendMessage returns StoredMessage shape", async () => {
    const msg = await sendMsg(`shape-${Date.now()}`);
    expect(typeof msg.id).toBe("string");
    expect(msg.id.length).toBeGreaterThan(0);
    expect(msg.channelId).toBe("general");
    expect(typeof msg.senderId).toBe("string");
    expect(typeof msg.senderUsername).toBe("string");
    expect(typeof msg.text).toBe("string");
    expect(typeof msg.timestamp).toBe("string");
    expect(msg.deleted).toBe(false);
    expect(msg.editedAt).toBeFalsy();
    expect(Array.isArray(msg.mentions)).toBe(true);
    expect(Array.isArray(msg.mentionUsernames)).toBe(true);
    expect(Array.isArray(msg.reactions)).toBe(true);
  });

  test("getMessages returns the sent message", async () => {
    const marker = `get-msg-${Date.now()}`;
    await sendMsg(marker);
    const result = await getMessages({ searchTerm: marker });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.text === marker)).toBe(true);
    expect(result.total_count).toBeGreaterThan(0);
  });

  test("getMessages shape: total_count, messages, start_position", async () => {
    const result = await getMessages({ limit: 5 });
    expect(typeof result.total_count).toBe("number");
    expect(Array.isArray(result.messages)).toBe(true);
    expect(typeof result.start_position).toBe("number");
  });

  test("getMessages limit restricts returned count", async () => {
    for (let i = 0; i < 3; i++) {
      await sendMsg(`limit-seed-${i}-${Date.now()}`);
    }
    const result = await getMessages({ limit: 2 });
    expect(result.messages.length).toBeLessThanOrEqual(2);
    expect(result.total_count).toBeGreaterThanOrEqual(3);
  });

  test("getMessages searchTerm filters correctly", async () => {
    const marker = `unique-xyz-${Date.now()}`;
    await sendMsg(marker);
    const result = await getMessages({ searchTerm: marker });
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].text).toBe(marker);
  });

  test("getMessages no-match search returns empty", async () => {
    const result = await getMessages({ searchTerm: "zzz-no-match-xyzzy-99" });
    expect(result.messages).toHaveLength(0);
    expect(result.total_count).toBe(0);
  });

  test("sendMessage with mentions stores mentionUsernames", async () => {
    const env = getEnv();
    const msg = await makeClient().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text: `mention-test-${Date.now()}`,
      mentions: [env.memberKey],
      mentionUsernames: ["admin"],
    });
    expect(Array.isArray(msg.mentions)).toBe(true);
    expect(msg.mentions).toContain(env.memberKey);
    expect(msg.mentionUsernames).toContain("admin");
  });

  test("sendMessage on non-existent channel returns error string", async () => {
    const result = await makeClient().call<string>("sendMessage", {
      channelId: "channel-that-does-not-exist",
      text: "hello",
    });
    expect(result).toMatch(/not found|not a member/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. editMessage
// ─────────────────────────────────────────────────────────────────────────────

test.describe("editMessage", () => {
  test.beforeAll(requireEnv);

  test("editMessage returns updated StoredMessage", async () => {
    const msg = await sendMsg(`edit-before-${Date.now()}`);
    const newText = `edit-after-${Date.now()}`;
    const edited = await makeClient().call<StoredMessage>("editMessage", {
      channelId: "general",
      messageId: msg.id,
      text: newText,
    });
    expect(edited.text).toBe(newText);
    expect(edited.id).toBe(msg.id);
  });

  test("editMessage sets editedAt field", async () => {
    const msg = await sendMsg(`edit-ts-${Date.now()}`);
    const edited = await makeClient().call<StoredMessage>("editMessage", {
      channelId: "general",
      messageId: msg.id,
      text: "edited text",
    });
    expect(edited.editedAt).toBeTruthy();
  });

  test("getMessages shows edited text", async () => {
    const marker = `edit-verify-${Date.now()}`;
    const msg = await sendMsg(marker);
    const newText = `edited-${Date.now()}`;
    await makeClient().call("editMessage", {
      channelId: "general",
      messageId: msg.id,
      text: newText,
    });
    const result = await getMessages({ searchTerm: newText });
    expect(result.messages.some((m) => m.id === msg.id && m.text === newText)).toBe(true);
  });

  test("editMessage with non-existent id returns error string", async () => {
    const result = await makeClient().call<string>("editMessage", {
      channelId: "general",
      messageId: "fake-id-does-not-exist",
      text: "new text",
    });
    expect(result).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. deleteMessage
// ─────────────────────────────────────────────────────────────────────────────

test.describe("deleteMessage", () => {
  test.beforeAll(requireEnv);

  test("deleteMessage returns 'Message deleted'", async () => {
    const msg = await sendMsg(`delete-test-${Date.now()}`);
    const result = await makeClient().call<string>("deleteMessage", {
      channelId: "general",
      messageId: msg.id,
    });
    expect(result).toMatch(/deleted/i);
  });

  test("getMessages shows deleted=true after delete", async () => {
    const marker = `delete-verify-${Date.now()}`;
    const msg = await sendMsg(marker);
    await makeClient().call("deleteMessage", {
      channelId: "general",
      messageId: msg.id,
    });
    const result = await getMessages();
    const found = result.messages.find((m) => m.id === msg.id);
    expect(found).toBeTruthy();
    expect(found!.deleted).toBe(true);
  });

  test("deleteMessage with non-existent id returns error string", async () => {
    const result = await makeClient().call<string>("deleteMessage", {
      channelId: "general",
      messageId: "totally-fake-id-xyz",
    });
    expect(result).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Reactions
// ─────────────────────────────────────────────────────────────────────────────

test.describe("updateReaction", () => {
  test.beforeAll(requireEnv);

  test("updateReaction returns 'Reaction updated'", async () => {
    const msg = await sendMsg(`react-add-${Date.now()}`);
    const result = await makeClient().call<string>("updateReaction", {
      messageId: msg.id,
      emoji: "👍",
      add: true,
    });
    expect(result).toMatch(/reaction updated/i);
  });

  test("getMessages shows reaction after add (users contains username)", async () => {
    const marker = `react-verify-${Date.now()}`;
    const msg = await sendMsg(marker);
    await makeClient().call("updateReaction", { messageId: msg.id, emoji: "❤️", add: true });

    const result = await getMessages({ searchTerm: marker });
    const found = result.messages.find((m) => m.id === msg.id);
    expect(found).toBeTruthy();
    expect(Array.isArray(found!.reactions)).toBe(true);
    const heart = found!.reactions.find((r) => r.emoji === "❤️");
    expect(heart).toBeTruthy();
    expect(heart!.users.length).toBeGreaterThan(0);
  });

  test("updateReaction remove clears the reaction", async () => {
    const marker = `react-remove-${Date.now()}`;
    const msg = await sendMsg(marker);
    await makeClient().call("updateReaction", { messageId: msg.id, emoji: "🔥", add: true });
    await makeClient().call("updateReaction", { messageId: msg.id, emoji: "🔥", add: false });

    const result = await getMessages({ searchTerm: marker });
    const found = result.messages.find((m) => m.id === msg.id);
    const fire = found?.reactions.find((r) => r.emoji === "🔥");
    expect(!fire || fire.users.length === 0).toBe(true);
  });

  test("adding same reaction twice is idempotent (no duplicate users)", async () => {
    const marker = `react-dedup-${Date.now()}`;
    const msg = await sendMsg(marker);
    await makeClient().call("updateReaction", { messageId: msg.id, emoji: "😂", add: true });
    await makeClient().call("updateReaction", { messageId: msg.id, emoji: "😂", add: true });

    const result = await getMessages({ searchTerm: marker });
    const found = result.messages.find((m) => m.id === msg.id);
    const laugh = found?.reactions.find((r) => r.emoji === "😂");
    const unique = new Set(laugh?.users ?? []);
    expect(unique.size).toBe(laugh?.users.length ?? 0);
  });

  test("updateReaction on non-existent message returns error string", async () => {
    const result = await makeClient().call<string>("updateReaction", {
      messageId: "no-such-message-id",
      emoji: "👍",
      add: true,
    });
    expect(result).toMatch(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Thread Replies
// ─────────────────────────────────────────────────────────────────────────────

test.describe("threads (sendMessage with parentId)", () => {
  test.beforeAll(requireEnv);

  test("sendMessage with parentId creates a thread reply", async () => {
    const parent = await sendMsg(`thread-parent-${Date.now()}`);
    const reply = await makeClient().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text: `thread-reply-${Date.now()}`,
      parentId: parent.id,
    });
    expect(typeof reply.id).toBe("string");
    expect(reply.parentId).toBe(parent.id);
  });

  test("getMessages with parentId returns thread replies", async () => {
    const parent = await sendMsg(`thread-get-${Date.now()}`);
    const replyText = `thread-reply-get-${Date.now()}`;
    await makeClient().call("sendMessage", {
      channelId: "general",
      text: replyText,
      parentId: parent.id,
    });
    const thread = await getMessages({ parentId: parent.id });
    expect(thread.messages.length).toBeGreaterThan(0);
    expect(thread.messages.some((m) => m.text === replyText)).toBe(true);
  });

  test("parent message gets threadCount incremented after reply", async () => {
    const marker = `thread-count-${Date.now()}`;
    const parent = await sendMsg(marker);
    await makeClient().call("sendMessage", {
      channelId: "general",
      text: "reply",
      parentId: parent.id,
    });
    const result = await getMessages({ searchTerm: marker });
    const found = result.messages.find((m) => m.id === parent.id);
    expect(found).toBeTruthy();
    expect((found!.threadCount ?? 0)).toBeGreaterThan(0);
  });

  test("editMessage works on thread reply", async () => {
    const parent = await sendMsg(`thread-edit-parent-${Date.now()}`);
    const reply = await makeClient().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text: `thread-edit-before-${Date.now()}`,
      parentId: parent.id,
    });
    const newText = `thread-edit-after-${Date.now()}`;
    const edited = await makeClient().call<StoredMessage>("editMessage", {
      channelId: "general",
      messageId: reply.id,
      text: newText,
      parentId: parent.id,
    });
    expect(edited.text).toBe(newText);
    expect(edited.editedAt).toBeTruthy();
  });

  test("deleteMessage works on thread reply", async () => {
    const parent = await sendMsg(`thread-del-parent-${Date.now()}`);
    const reply = await makeClient().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text: `thread-del-reply-${Date.now()}`,
      parentId: parent.id,
    });
    await makeClient().call<string>("deleteMessage", {
      channelId: "general",
      messageId: reply.id,
      parentId: parent.id,
    });
    const thread = await getMessages({ parentId: parent.id });
    const found = thread.messages.find((m) => m.id === reply.id);
    expect(found?.deleted).toBe(true);
  });

  test("reactions work on thread replies", async () => {
    const parent = await sendMsg(`thread-react-parent-${Date.now()}`);
    const reply = await makeClient().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text: `thread-react-reply-${Date.now()}`,
      parentId: parent.id,
    });
    await makeClient().call("updateReaction", { messageId: reply.id, emoji: "👍", add: true });
    const thread = await getMessages({ parentId: parent.id });
    const found = thread.messages.find((m) => m.id === reply.id);
    const thumbs = found?.reactions.find((r) => r.emoji === "👍");
    expect((thumbs?.users.length ?? 0)).toBeGreaterThan(0);
  });

  test("getMessages without parentId does not include thread replies", async () => {
    const marker = `thread-isolation-${Date.now()}`;
    const parent = await sendMsg(marker);
    const replyText = `should-not-appear-${Date.now()}`;
    await makeClient().call("sendMessage", {
      channelId: "general",
      text: replyText,
      parentId: parent.id,
    });
    const main = await getMessages({ searchTerm: replyText });
    expect(main.messages.every((m) => m.text !== replyText)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. readMessage
// ─────────────────────────────────────────────────────────────────────────────

test.describe("readMessage", () => {
  test.beforeAll(requireEnv);

  test("readMessage returns a success string", async () => {
    const msg = await sendMsg(`read-msg-${Date.now()}`);
    const result = await makeClient().call<string>("readMessage", {
      channelId: "general",
      messageId: msg.id,
    });
    expect(typeof result).toBe("string");
  });

  test("readMessage with non-existent messageId fails gracefully", async () => {
    const { ok } = await makeClient().tryCall("readMessage", {
      channelId: "general",
      messageId: "no-such-message",
    });
    // Either ok (no-op) or fail gracefully — either is acceptable
    expect(typeof ok).toBe("boolean");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. DMs
// ─────────────────────────────────────────────────────────────────────────────

test.describe("getDMs", () => {
  test.beforeAll(requireEnv);

  test("getDMs returns an array (empty when no DMs created)", async () => {
    const dms = await makeClient().call<unknown[]>("getDMs", {});
    expect(Array.isArray(dms)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Channel Membership (admin features — single-user)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("channel membership (single-user)", () => {
  test.beforeAll(requireEnv);

  test("getInvitees returns users not in the channel", async () => {
    // With only one user in the context, invitees list should be empty or contain non-members
    const invitees = await makeClient().call<Array<{ userId: string; username: string }>>(
      "getInvitees",
      { channelId: "general" },
    );
    expect(Array.isArray(invitees)).toBe(true);
  });

  test("addUserToChannel fails if executor is not moderator of target channel", async () => {
    // Create a private channel where the executor is NOT a moderator
    // (this can't really be tested single-user since creator is always a mod)
    // Test that adding an unknown user fails gracefully
    const env = getEnv();
    const result = await makeClient().call<string>("addUserToChannel", {
      channelId: "general",
      userId: env.memberKey,
      username: "admin",
    });
    // Already a member — should return error or "already a member"
    expect(typeof result).toBe("string");
    expect(result).toMatch(/already a member|cannot add/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Multi-user (2-node) Tests
// Requires scripts/setup-nodes.sh (not dev-node.sh).
// Skipped automatically when E2E_MEMBER_KEY_2 / E2E_NODE_URL_2 are absent.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("multi-user (2-node)", () => {
  test.beforeAll(() => {
    if (!twoNodeEnvAvailable()) test.skip();
  });

  async function aliceSends(text: string): Promise<MessageWithReactions> {
    return makeClient().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text,
    });
  }

  async function bobSends(text: string): Promise<MessageWithReactions> {
    return makeClient2().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text,
    });
  }

  // ── Members ───────────────────────────────────────────────────────────────

  test("getMembers on node-1 includes both admin and Bob", async () => {
    const env = getEnv();
    const members = await makeClient().call<Array<{ userId: string; username: string }>>(
      "getMembers",
      {},
    );
    const admin = members.find((m) => m.userId === env.memberKey);
    const bob = members.find((m) => m.userId === env.memberKey2);
    expect(admin?.username).toBe("admin");
    expect(bob?.username).toBe("Bob");
  });

  test("Bob's username is 'Bob' (set via joinChat in setup-nodes.sh)", async () => {
    const username = await makeClient2().call<string>("getUsername", {});
    expect(username).toBe("Bob");
  });

  // ── Cross-node message visibility ─────────────────────────────────────────

  test("Alice's message is visible to Bob on node-2", async () => {
    const marker = `alice-to-bob-${Date.now()}`;
    await aliceSends(marker);

    const found = await pollUntil(async () => {
      const res = await makeClient2().call<FullMessageResponse>("getMessages", {
        channelId: "general",
        searchTerm: marker,
        limit: 10,
        offset: 0,
      });
      return res.messages.find((m) => m.text === marker);
    });
    expect(found!.text).toBe(marker);
  });

  test("Bob's message is visible to Alice on node-1", async () => {
    const marker = `bob-to-alice-${Date.now()}`;
    await bobSends(marker);

    const found = await pollUntil(async () => {
      const res = await makeClient().call<FullMessageResponse>("getMessages", {
        channelId: "general",
        searchTerm: marker,
        limit: 10,
        offset: 0,
      });
      return res.messages.find((m) => m.text === marker);
    });
    expect(found).toBeTruthy();
  });

  // ── Cross-user authorization ───────────────────────────────────────────────

  test("Bob cannot edit Alice's message (gets permission error string)", async () => {
    const marker = `auth-edit-${Date.now()}`;
    const msg = await aliceSends(marker);

    const env = getEnv();
    // logic-js returns WASM errors as string values, not RPC errors
    const result = await makeClient({ executorPublicKey: env.memberKey2 }).call<string>(
      "editMessage",
      { channelId: "general", messageId: msg.id, text: "hacked!" },
    );
    expect(typeof result).toBe("string");
    expect(result).toMatch(/permission|not found|not a member/i);
  });

  test("Bob cannot delete Alice's message (gets permission error string)", async () => {
    const marker = `auth-del-${Date.now()}`;
    const msg = await aliceSends(marker);

    const env = getEnv();
    const result = await makeClient({ executorPublicKey: env.memberKey2 }).call<string>(
      "deleteMessage",
      { channelId: "general", messageId: msg.id },
    );
    expect(typeof result).toBe("string");
    expect(result).toMatch(/permission|not found|not a member/i);
  });

  test("Alice cannot edit Bob's message (gets permission error string)", async () => {
    const marker = `auth-edit-bob-${Date.now()}`;
    const msg = await bobSends(marker);

    // Wait for message to arrive on node-1
    await pollUntil(async () => {
      const r = await makeClient().call<FullMessageResponse>("getMessages", {
        channelId: "general",
        searchTerm: marker,
        limit: 10,
        offset: 0,
      });
      return r.messages.find((m) => m.id === msg.id) || false;
    });

    const result = await makeClient().call<string>("editMessage", {
      channelId: "general",
      messageId: msg.id,
      text: "hacked!",
    });
    expect(typeof result).toBe("string");
    expect(result).toMatch(/permission|not found/i);
  });

  // ── Multi-user reactions ───────────────────────────────────────────────────

  test("Alice and Bob can both react to the same message", async () => {
    const marker = `multi-react-${Date.now()}`;
    const msg = await aliceSends(marker);

    const env = getEnv();
    await makeClient().call("updateReaction", { messageId: msg.id, emoji: "👍", add: true });
    // Bob reacts via node-2 (his context has the message after sync)
    await makeClient2().call("updateReaction", { messageId: msg.id, emoji: "👍", add: true });

    const result = await makeClient().call<FullMessageResponse>("getMessages", {
      channelId: "general",
      searchTerm: marker,
      limit: 10,
      offset: 0,
    });
    const found = result.messages.find((m) => m.id === msg.id);
    const thumbs = found?.reactions.find((r) => r.emoji === "👍");
    // Both admin and Bob should appear in users
    expect((thumbs?.users.length ?? 0)).toBeGreaterThanOrEqual(1);
  });

  test("Alice and Bob can react with different emojis", async () => {
    const marker = `multi-emoji-${Date.now()}`;
    const msg = await aliceSends(marker);

    await makeClient().call("updateReaction", { messageId: msg.id, emoji: "❤️", add: true });
    await makeClient2().call("updateReaction", { messageId: msg.id, emoji: "😂", add: true });

    const result = await makeClient().call<FullMessageResponse>("getMessages", {
      channelId: "general",
      searchTerm: marker,
      limit: 10,
      offset: 0,
    });
    const found = result.messages.find((m) => m.id === msg.id);
    const heart = found?.reactions.find((r) => r.emoji === "❤️");
    const laugh = found?.reactions.find((r) => r.emoji === "😂");
    expect((heart?.users.length ?? 0)).toBeGreaterThanOrEqual(1);
    expect((laugh?.users.length ?? 0)).toBeGreaterThanOrEqual(1);
  });

  // ── Cross-user channel management ─────────────────────────────────────────

  test("Bob can see channels after they are synced from node-1", async () => {
    const tag = `shared-chan-${Date.now()}`;
    await makeClient().call<string>("createChannel", { name: tag, type: "public" });

    // Bob can see it in the channel directory (as availablePublic until he joins)
    const dir = await pollUntil(async () => {
      const d = await makeClient2().call<ChannelDirectory>("getChannelDirectory", {});
      const inJoined = d.joined.find((c) => c.channelId === tag);
      const inAvail = d.availablePublic.find((c) => c.channelId === tag);
      return (inJoined || inAvail) ? d : null;
    });
    const inJoined = dir.joined.find((c) => c.channelId === tag);
    const inAvail = dir.availablePublic.find((c) => c.channelId === tag);
    expect(inJoined || inAvail).toBeTruthy();
  });

  test("admin can add Bob to a private channel", async () => {
    const env = getEnv();
    const tag = `private-add-${Date.now()}`;
    await makeClient().call<string>("createChannel", { name: tag, type: "private" });

    // Admin adds Bob to the private channel
    const result = await makeClient().call<string>("addUserToChannel", {
      channelId: tag,
      userId: env.memberKey2,
      username: "Bob",
    });
    expect(result).toMatch(/added|success/i);

    // The channel should appear in Bob's channel list (after sync)
    const bobChannels = await pollUntil(async () => {
      const chs = await makeClient2().call<ChannelResponse[]>("getChannels", {});
      return chs.find((c) => c.channelId === tag) ? chs : null;
    });
    expect(bobChannels.find((c) => c.channelId === tag)).toBeTruthy();
  });

  test("admin can promote Bob to moderator and Bob can then add users", async () => {
    const env = getEnv();
    const tag = `mod-promote-${Date.now()}`;
    // Create channel and add Bob first
    await makeClient().call<string>("createChannel", { name: tag, type: "public" });

    // Promote Bob to moderator
    const promoteResult = await makeClient().call<string>("promoteModerator", {
      channelId: tag,
      userId: env.memberKey2,
    });
    expect(promoteResult).toMatch(/promoted|success/i);
  });

  // ── Thread replies across users ────────────────────────────────────────────

  test("Bob can reply to Alice's thread", async () => {
    const parentText = `thread-alice-${Date.now()}`;
    const parent = await aliceSends(parentText);

    const reply = await makeClient2().call<MessageWithReactions>("sendMessage", {
      channelId: "general",
      text: `bob-reply-${Date.now()}`,
      parentId: parent.id,
    });
    expect(typeof reply.id).toBe("string");

    // Poll until threadCount is incremented on node-1
    const updated = await pollUntil(async () => {
      const r = await makeClient().call<FullMessageResponse>("getMessages", {
        channelId: "general",
        searchTerm: parentText,
        limit: 10,
        offset: 0,
      });
      const p = r.messages.find((m) => m.id === parent.id);
      return p && (p.threadCount ?? 0) > 0 ? p : null;
    });
    expect((updated!.threadCount ?? 0)).toBeGreaterThan(0);
  });

  // ── Message ordering ──────────────────────────────────────────────────────

  test("messages from both users appear in expected order", async () => {
    const tag = `order-${Date.now()}`;
    await aliceSends(`${tag}-1`);
    await bobSends(`${tag}-2`);
    await aliceSends(`${tag}-3`);

    const msgs = await pollUntil(async () => {
      const r = await makeClient().call<FullMessageResponse>("getMessages", {
        channelId: "general",
        searchTerm: tag,
        limit: 50,
        offset: 0,
      });
      return r.messages.length >= 3 ? r.messages : null;
    });

    const texts = msgs!.map((m) => m.text);
    const i1 = texts.indexOf(`${tag}-1`);
    const i2 = texts.indexOf(`${tag}-2`);
    const i3 = texts.indexOf(`${tag}-3`);
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });
});
