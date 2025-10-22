import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { FullMessageResponse } from "../api/clientApi";
import type { ActiveChat, CurbMessage, ChatMessagesData, ChatMessagesDataWithOlder } from "../types/Common";
import { transformMessageToUI, transformMessagesToUI } from "../utils/messageTransformers";
import { MESSAGE_PAGE_SIZE, RECENT_MESSAGES_CHECK_SIZE } from "../constants/app";

/**
 * Custom hook for managing messages in a chat
 * Handles loading, pagination, and incoming messages
 */
export function useMessages() {
  const [messages, setMessages] = useState<CurbMessage[]>([]);
  const [incomingMessages, setIncomingMessages] = useState<CurbMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(MESSAGE_PAGE_SIZE);
  const messagesRef = useRef<CurbMessage[]>([]);

  /**
   * Load initial messages for a chat
   */
  const loadInitial = useCallback(async (
    activeChat: ActiveChat | null
  ): Promise<ChatMessagesData> => {
    if (!activeChat?.name) {
      return {
        messages: [],
        totalCount: 0,
        hasMore: false,
      };
    }

    const isDM = activeChat.type === "direct_message";
    const response: ResponseData<FullMessageResponse> =
      await new ClientApiDataSource().getMessages({
        group: { name: (isDM ? "private_dm" : activeChat.name) || "" },
        limit: MESSAGE_PAGE_SIZE,
        offset: 0,
        is_dm: isDM,
        dm_identity: activeChat.account,
      });

    if (response.data) {
      const messagesArray = transformMessagesToUI(response.data.messages);
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

    return {
      messages: [],
      totalCount: 0,
      hasMore: false,
    };
  }, []);

  /**
   * Load previous (older) messages for pagination
   */
  const loadPrevious = useCallback(async (
    activeChat: ActiveChat | null,
    _chatId: string
  ): Promise<ChatMessagesDataWithOlder> => {
    if (!activeChat || offset >= totalCount) {
      return {
        messages: [],
        totalCount,
        hasOlder: false,
      };
    }

    const isDM = activeChat.type === "direct_message";
    const response: ResponseData<FullMessageResponse> =
      await new ClientApiDataSource().getMessages({
        group: {
          name: (isDM ? "private_dm" : activeChat.name) || "",
        },
        limit: MESSAGE_PAGE_SIZE,
        offset,
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
  }, [offset, totalCount]);

  /**
   * Check for and add new messages from websocket events
   */
  const checkForNewMessages = useCallback(async (
    activeChat: ActiveChat | null,
    isDM: boolean
  ): Promise<CurbMessage[]> => {
    if (!activeChat) return [];

    const response: ResponseData<FullMessageResponse> =
      await new ClientApiDataSource().getMessages({
        group: {
          name: (isDM ? "private_dm" : activeChat.name) || "",
        },
        limit: RECENT_MESSAGES_CHECK_SIZE,
        offset: 0,
        is_dm: isDM,
        dm_identity: activeChat.account,
      });

    if (!response.data) return [];

    // Transform messages - MessageStore will handle deduplication
    const newMessages = response.data.messages.map((msg) => transformMessageToUI(msg));

    if (newMessages.length > 0) {
      // Only update ref, not state (MessageStore will deduplicate in VirtualizedChat)
      messagesRef.current = [...messagesRef.current, ...newMessages];
      return newMessages;
    }

    return [];
  }, []);

  /**
   * Add incoming messages (from websocket) 
   * MessageStore handles deduplication of optimistic messages
   */
  const addIncoming = useCallback((newMessages: CurbMessage[]) => {
    if (newMessages.length > 0) {
      // Just pass to VirtualizedChat - MessageStore will handle cleanup
      setIncomingMessages(newMessages);
    }
  }, []);
  
  /**
   * Add optimistic message (for messages being sent)
   */
  const addOptimistic = useCallback((message: CurbMessage) => {
    // Add to ref immediately for local tracking
    messagesRef.current = [...messagesRef.current, message];
    // Set incomingMessages to trigger VirtualizedChat update
    setIncomingMessages([message]);
  }, []);

  /**
   * Clear all messages (when switching chats)
   */
  const clear = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setIncomingMessages([]);
    setTotalCount(0);
    setOffset(MESSAGE_PAGE_SIZE);
  }, []);

  /**
   * Get current messages from ref (for immediate access)
   */
  const getCurrent = useCallback(() => {
    return messagesRef.current;
  }, []);

  return {
    messages,
    incomingMessages,
    totalCount,
    messagesRef,
    loadInitial,
    loadPrevious,
    checkForNewMessages,
    addIncoming,
    addOptimistic,
    clear,
    getCurrent,
  };
}

