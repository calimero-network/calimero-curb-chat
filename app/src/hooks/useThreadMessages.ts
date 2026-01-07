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

      // First, get the total count by fetching with offset: 0
      const initialResponse: ResponseData<FullMessageResponse> =
        await new ClientApiDataSource().getMessages({
          group: { name: groupName },
          limit: MESSAGE_PAGE_SIZE,
          offset: 0,
          parent_message: parentMessageId,
          is_dm: isDM,
          dm_identity: activeChat.account,
        });

      log.debug("useThreadMessages", `Initial API response:`, initialResponse);

      if (initialResponse.error) {
        const parsedError = parseErrorMessage(initialResponse.error.message);
        log.error("useThreadMessages", `API returned error:`, initialResponse.error);
        log.error("useThreadMessages", `Parsed error message: ${parsedError}`);
      }

      if (!initialResponse.data) {
        log.debug("useThreadMessages", "No response data, returning empty");
        return {
          messages: [],
          totalCount: 0,
          hasMore: false,
        };
      }

      const totalCount = initialResponse.data.total_count;
      
      // If total count is less than or equal to page size, use the initial response
      if (totalCount <= MESSAGE_PAGE_SIZE) {
        const messagesArray = transformMessagesToUI(initialResponse.data.messages);
        log.debug(
          "useThreadMessages",
          `loadInitial loaded ${messagesArray.length} messages (total: ${totalCount})`,
        );
        messagesRef.current = messagesArray;
        setMessages(messagesArray);
        setTotalCount(totalCount);
        setOffset(MESSAGE_PAGE_SIZE);

        return {
          messages: messagesArray,
          totalCount: totalCount,
          hasMore: false,
        };
      }

      // If there are more messages than the page size, calculate offset to get the most recent ones
      const calculatedOffset = Math.max(0, totalCount - MESSAGE_PAGE_SIZE);
      log.debug(
        "useThreadMessages",
        `Total count (${totalCount}) > page size (${MESSAGE_PAGE_SIZE}), fetching most recent messages with offset: ${calculatedOffset}`,
      );

      const recentResponse: ResponseData<FullMessageResponse> =
        await new ClientApiDataSource().getMessages({
          group: { name: groupName },
          limit: MESSAGE_PAGE_SIZE,
          offset: calculatedOffset,
          parent_message: parentMessageId,
          is_dm: isDM,
          dm_identity: activeChat.account,
        });

      log.debug("useThreadMessages", `Recent messages API response:`, recentResponse);

      if (recentResponse.data) {
        const messagesArray = transformMessagesToUI(recentResponse.data.messages);
        log.debug(
          "useThreadMessages",
          `loadInitial loaded ${messagesArray.length} most recent messages (total: ${totalCount})`,
        );
        messagesRef.current = messagesArray;
        setMessages(messagesArray);
        setTotalCount(totalCount);
        setOffset(calculatedOffset + MESSAGE_PAGE_SIZE);

        return {
          messages: messagesArray,
          totalCount: totalCount,
          hasMore: calculatedOffset > 0,
        };
      }

      log.debug("useThreadMessages", "No response data from recent fetch, returning empty");
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
      if (!activeChat) {
        return {
          messages: [],
          totalCount,
          hasOlder: false,
        };
      }

      // Calculate the earliest position we've loaded so far
      const earliestLoadedPosition = offset - MESSAGE_PAGE_SIZE;
      
      // If we've already loaded from position 0, there are no more older messages
      if (earliestLoadedPosition <= 0) {
        log.debug(
          "useThreadMessages",
          `loadPrevious: Already at the beginning (earliestLoadedPosition: ${earliestLoadedPosition})`,
        );
        return {
          messages: [],
          totalCount,
          hasOlder: false,
        };
      }

      // Calculate offset for the next batch of older messages
      const olderOffset = Math.max(0, earliestLoadedPosition - MESSAGE_PAGE_SIZE);

      const isDM = activeChat.type === "direct_message";
      const groupName = isDM ? "private_dm" : activeChat.name || "";

      log.debug(
        "useThreadMessages",
        `loadPrevious: earliestLoaded=${earliestLoadedPosition}, fetching from offset=${olderOffset}, current offset=${offset}`,
      );

      const response: ResponseData<FullMessageResponse> =
        await new ClientApiDataSource().getMessages({
          group: { name: groupName },
          limit: MESSAGE_PAGE_SIZE,
          offset: olderOffset,
          parent_message: parentMessageId,
          is_dm: isDM,
          dm_identity: activeChat.account,
        });

      if (response.data) {
        const messagesArray = transformMessagesToUI(response.data.messages);
        
        if (messagesArray.length === 0) {
          log.debug("useThreadMessages", `loadPrevious: No messages returned`);
          return {
            messages: [],
            totalCount: response.data.total_count,
            hasOlder: false,
          };
        }

        // Update offset to reflect the new earliest position
        const newOffset = olderOffset + MESSAGE_PAGE_SIZE;
        setOffset(newOffset);
        
        log.debug(
          "useThreadMessages",
          `loadPrevious loaded ${messagesArray.length} older messages, new offset: ${newOffset}, hasOlder: ${olderOffset > 0}`,
        );

        return {
          messages: messagesArray,
          totalCount: response.data.total_count,
          hasOlder: olderOffset > 0,
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
