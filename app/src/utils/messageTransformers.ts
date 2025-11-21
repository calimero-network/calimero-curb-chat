import type {
  AttachmentResponse,
  MessageWithReactions,
} from "../api/clientApi";
import type { CurbFile, CurbMessage } from "../types/Common";
import { MessageStatus } from "../types/Common";

function mapAttachmentToCurbFile(attachment: AttachmentResponse): CurbFile {
  return {
    name: attachment.name,
    ipfs_cid: attachment.blob_id,
    mime_type: attachment.mime_type,
    size: attachment.size,
    uploaded_at: attachment.uploaded_at,
  };
}

/**
 * Transforms a MessageWithReactions from the API to a CurbMessage for UI display
 */
export function transformMessageToUI(
  message: MessageWithReactions,
): CurbMessage {
  // Timestamp should be in milliseconds from getMessages transformation
  // For backward compatibility: if timestamp < 1e10, assume it's in seconds and convert
  // Otherwise assume it's already in milliseconds
  const timestampMs = message.timestamp < 1e10 
    ? message.timestamp * 1000 
    : message.timestamp;

  // Convert thread_last_timestamp if present
  const threadLastTimestamp = message.threadLastTimestamp 
    ? (message.threadLastTimestamp < 1e10 
        ? message.threadLastTimestamp * 1000 
        : message.threadLastTimestamp)
    : undefined;

  // Convert edited_on if present
  const editedOn = message.editedAt
    ? (message.editedAt < 1e10 
        ? message.editedAt * 1000 
        : message.editedAt)
    : undefined;

  return {
    id: message.id,
    text: message.text,
    nonce: Math.random().toString(36).substring(2, 15),
    key: message.id,
    timestamp: timestampMs,
    sender: message.sender,
    senderUsername: message.senderUsername,
    reactions: message.reactions,
    threadCount: message.threadCount,
    threadLastTimestamp: threadLastTimestamp,
    editedOn: editedOn,
    mentions: message.mentionUsernames,
    files: (message.files ?? []).map(mapAttachmentToCurbFile),
    images: (message.images ?? []).map(mapAttachmentToCurbFile),
    editMode: false,
    status: MessageStatus.sent,
    deleted: message.deleted,
    group: message.group,
  };
}

/**
 * Transforms an array of MessageWithReactions to CurbMessages
 */
export function transformMessagesToUI(
  messages: MessageWithReactions[],
): CurbMessage[] {
  return messages.map(transformMessageToUI);
}

/**
 * Filters and transforms new messages that don't already exist in the current message list
 */
export function getNewMessages(
  apiMessages: MessageWithReactions[],
  existingMessages: CurbMessage[],
): CurbMessage[] {
  const existingMessageIds = new Set(existingMessages.map((msg) => msg.id));

  return apiMessages
    .filter((message) => !existingMessageIds.has(message.id))
    .map(transformMessageToUI);
}
