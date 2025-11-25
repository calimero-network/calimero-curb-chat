import { useState, useRef, useCallback, useEffect } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { FullMessageResponse } from "../api/clientApi";
import type {
  ActiveChat,
  CurbMessage,
  ChatMessagesData,
  ChatMessagesDataWithOlder,
} from "../types/Common";
import {
  transformMessageToUI,
  transformMessagesToUI,
} from "../utils/messageTransformers";
import {
  MESSAGE_PAGE_SIZE,
  RECENT_MESSAGES_CHECK_SIZE,
} from "../constants/app";
import { log } from "../utils/logger";
import { parseErrorMessage } from "../utils/errorParser";

/**
 * Custom hook for managing thread messages
 * Similar to useMessages but for message threads
 */
export function useThreadMessages() {
  const [messages, setMessages] = useState<CurbMessage[]>([]);
  const [incomingMessages, setIncomingMessages] = useState<CurbMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(MESSAGE_PAGE_SIZE);
  const messagesRef = useRef<CurbMessage[]>([]);

  // Debug logging for state changes
  useEffect(() => {
    log.debug(
      "useThreadMessages",
      `messages state changed, length: ${messages.length}`,
    );
  }, [messages]);

  useEffect(() => {
    log.debug(
      "useThreadMessages",
      `incomingMessages state changed, length: ${incomingMessages.length}`,
      incomingMessages,
    );
  }, [incomingMessages]);

  /**
   * Load initial thread messages
   */
  const loadInitial = useCallback(
    async (
      activeChat: ActiveChat | null,
      parentMessageId: string,
    ): Promise<ChatMessagesData> => {
      log.debug(
        "useThreadMessages",
        `loadInitial called for parent: ${parentMessageId}`,
      );
      if (!activeChat?.name) {
        log.debug("useThreadMessages", "No active chat name, returning empty");
        return {
          messages: [],
          totalCount: 0,
          hasMore: false,
        };
      }

      const isDM = activeChat.type === "direct_message";
      const groupName = isDM ? "private_dm" : activeChat.name || "";

      log.debug("useThreadMessages", `Calling API with params:`, {
        group: groupName,
        parent_message: parentMessageId,
        is_dm: isDM,
        dm_identity: activeChat.account,
      });

      const response: ResponseData<FullMessageResponse> =
        await new ClientApiDataSource().getMessages({
          group: { name: groupName },
          limit: MESSAGE_PAGE_SIZE,
          offset: 0,
          parent_message: parentMessageId,
          is_dm: isDM,
          dm_identity: activeChat.account,
        });

      log.debug("useThreadMessages", `API response:`, response);

      if (response.error) {
        const parsedError = parseErrorMessage(response.error.message);
        log.error("useThreadMessages", `API returned error:`, response.error);
        log.error("useThreadMessages", `Parsed error message: ${parsedError}`);
      }

      if (response.data) {
        const messagesArray = transformMessagesToUI(response.data.messages);
        log.debug(
          "useThreadMessages",
          `loadInitial loaded ${messagesArray.length} messages`,
        );
        messagesRef.current = messagesArray;
        setMessages(messagesArray);
        setTotalCount(response.data.total_count);
        setOffset(MESSAGE_PAGE_SIZE);

        return {
          messages: messagesArray,
          totalCount: response.data.total_count,
          hasMore: response.data.start_position < response.data.total_count,
        };
      }

      log.debug("useThreadMessages", "No response data, returning empty");
      return {
        messages: [],
        totalCount: 0,
        hasMore: false,
      };
    },
    [],
  );

  /**
   * Load previous (older) thread messages
   */
  const loadPrevious = useCallback(
    async (
      activeChat: ActiveChat | null,
      parentMessageId: string,
    ): Promise<ChatMessagesDataWithOlder> => {
      if (!activeChat || offset >= totalCount) {
        return {
          messages: [],
          totalCount,
          hasOlder: false,
        };
      }

      const isDM = activeChat.type === "direct_message";
      const groupName = isDM ? "private_dm" : activeChat.name || "";

      const response: ResponseData<FullMessageResponse> =
        await new ClientApiDataSource().getMessages({
          group: { name: groupName },
          limit: MESSAGE_PAGE_SIZE,
          offset,
          parent_message: parentMessageId,
          is_dm: isDM,
          dm_identity: activeChat.account,
        });

      if (response.data) {
        const messagesArray = transformMessagesToUI(response.data.messages);
        setOffset(offset + MESSAGE_PAGE_SIZE);

        return {
          messages: messagesArray,
          totalCount: response.data.total_count,
          hasOlder: response.data.start_position < response.data.total_count,
        };
      }

      return {
        messages: [],
        totalCount: 0,
        hasOlder: false,
      };
    },
    [offset, totalCount],
  );

  /**
   * Add optimistic message (for messages being sent)
   */
  const addOptimistic = useCallback((message: CurbMessage) => {
    log.debug(
      "useThreadMessages",
      `addOptimistic called for message:`,
      message,
    );
    const newMessages = [...messagesRef.current, message];
    messagesRef.current = newMessages;
    setMessages(newMessages);
    // Also add to incomingMessages for VirtualizedChat to display
    setIncomingMessages((prev) => [...prev, message]);
    log.debug(
      "useThreadMessages",
      `Total thread messages after optimistic add: ${newMessages.length}`,
    );
  }, []);

  /**
   * Check for and add new thread messages from websocket events
   */
  const checkForNewThreadMessages = useCallback(
    async (
      activeChat: ActiveChat | null,
      parentMessageId: string,
    ): Promise<CurbMessage[]> => {
      if (!activeChat || !parentMessageId) {
        log.debug(
          "useThreadMessages",
          "Skipping thread message check - no active chat or parent message ID",
        );
        return [];
      }

      // Removed throttling to allow real-time thread message updates

      const isDM = activeChat.type === "direct_message";
      const groupName = isDM ? "private_dm" : activeChat.name || "";

      log.debug(
        "useThreadMessages",
        `Fetching thread messages for parent: ${parentMessageId}`,
      );
      const response: ResponseData<FullMessageResponse> =
        await new ClientApiDataSource().getMessages({
          group: { name: groupName },
          limit: RECENT_MESSAGES_CHECK_SIZE,
          offset: 0,
          parent_message: parentMessageId,
          is_dm: isDM,
          dm_identity: activeChat.account,
        });

      if (!response.data) {
        log.debug("useThreadMessages", "No response data from API");
        return [];
      }

      // Transform messages
      const fetchedMessages = response.data.messages.map((msg) =>
        transformMessageToUI(msg),
      );

      // Get existing message IDs to track which ones are new vs updated
      const existingMessageIds = new Set(
        messagesRef.current.map((msg) => msg.id)
      );

      // Separate new messages from updated messages
      const newMessages: CurbMessage[] = [];
      const updatedMessages: CurbMessage[] = [];

      for (const msg of fetchedMessages) {
        if (existingMessageIds.has(msg.id)) {
          // Message already exists - this is an update (edit/delete)
          updatedMessages.push(msg);
        } else {
          // New message
          newMessages.push(msg);
        }
      }

      // Update ref with new messages only (MessageStore will handle updates)
      if (newMessages.length > 0) {
        messagesRef.current = [...messagesRef.current, ...newMessages];
        log.debug(
          "useThreadMessages",
          `Found ${newMessages.length} new thread messages, ${updatedMessages.length} updated`,
        );
      } else if (updatedMessages.length > 0) {
        log.debug(
          "useThreadMessages",
          `Found ${updatedMessages.length} updated thread messages`,
        );
      } else {
        log.debug("useThreadMessages", "No new or updated thread messages found");
        return [];
      }

      // Return ALL messages (both new and updated) so MessageStore can handle updates
      // MessageStore.append() has logic to update existing messages in place
      return fetchedMessages;
    },
    [],
  );

  /**
   * Add incoming messages (from websocket)
   */
  const addIncoming = useCallback((newMessages: CurbMessage[]) => {

    log.debug(
      "useThreadMessages",
      `addIncoming called with ${newMessages.length} messages`,
    );
    if (newMessages.length > 0) {
      log.debug("useThreadMessages", `Setting incoming messages:`, newMessages);
      setIncomingMessages(newMessages);
    }
  }, []);

  /**
   * Clear thread messages
   */
  const clear = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setIncomingMessages([]);
    setTotalCount(0);
    setOffset(MESSAGE_PAGE_SIZE);
  }, []);

  return {
    messages,
    incomingMessages,
    totalCount,
    messagesRef,
    loadInitial,
    loadPrevious,
    addOptimistic,
    addIncoming,
    checkForNewThreadMessages,
    clear,
  };
}
