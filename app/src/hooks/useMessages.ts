import { useState, useRef, useCallback } from "react";
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
  const processedMessageIds = useRef<Set<string>>(new Set());
  const incomingMessagesQueue = useRef<CurbMessage[]>([]);

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
      
      // Reset processed IDs when loading initial messages
      processedMessageIds.current = new Set(messagesArray.map(m => m.id));

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

    // Filter out messages we've already processed
    const newMessages = response.data.messages
      .filter((msg) => !processedMessageIds.current.has(msg.id))
      .map((msg) => transformMessageToUI(msg));

    if (newMessages.length > 0) {
      // Mark these messages as processed
      newMessages.forEach((msg) => processedMessageIds.current.add(msg.id));
      
      messagesRef.current = [...messagesRef.current, ...newMessages];
      
      // Replace incoming messages (don't append) to avoid duplicates
      incomingMessagesQueue.current = newMessages;
      setIncomingMessages(newMessages);
      
      return newMessages;
    }

    return [];
  }, []);

  /**
   * Add incoming messages (from websocket)
   */
  const addIncoming = useCallback((newMessages: CurbMessage[]) => {
    if (newMessages.length > 0) {
      // Filter out already processed messages
      const trulyNewMessages = newMessages.filter(
        msg => !processedMessageIds.current.has(msg.id)
      );
      
      if (trulyNewMessages.length > 0) {
        trulyNewMessages.forEach(msg => processedMessageIds.current.add(msg.id));
        messagesRef.current = [...messagesRef.current, ...trulyNewMessages];
        
        // Replace incoming messages (don't append)
        incomingMessagesQueue.current = trulyNewMessages;
        setIncomingMessages(trulyNewMessages);
      }
    }
  }, []);
  
  /**
   * Clear incoming messages queue (call after VirtualizedChat processes them)
   */
  const clearIncoming = useCallback(() => {
    if (incomingMessagesQueue.current.length > 0) {
      incomingMessagesQueue.current = [];
      setIncomingMessages([]);
    }
  }, []);

  /**
   * Clear all messages (when switching chats)
   */
  const clear = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    incomingMessagesQueue.current = [];
    setIncomingMessages([]);
    setTotalCount(0);
    setOffset(MESSAGE_PAGE_SIZE);
    processedMessageIds.current.clear();
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
    clearIncoming,
    clear,
    getCurrent,
  };
}

