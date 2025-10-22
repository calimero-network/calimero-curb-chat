import { useState, useRef, useCallback, useEffect } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { FullMessageResponse } from "../api/clientApi";
import type { ActiveChat, CurbMessage, ChatMessagesData, ChatMessagesDataWithOlder } from "../types/Common";
import { transformMessagesToUI } from "../utils/messageTransformers";
import { MESSAGE_PAGE_SIZE } from "../constants/app";

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

  // Auto-clear incoming messages immediately after render
  // This prevents duplicate rendering in VirtualizedChat
  useEffect(() => {
    if (incomingMessages.length > 0) {
      // Use queueMicrotask to clear after VirtualizedChat has seen them
      queueMicrotask(() => {
        setIncomingMessages([]);
      });
    }
  }, [incomingMessages]);

  /**
   * Load initial thread messages
   */
  const loadInitial = useCallback(async (
    activeChat: ActiveChat | null,
    parentMessageId: string
  ): Promise<ChatMessagesData> => {
    if (!activeChat?.name) {
      return {
        messages: [],
        totalCount: 0,
        hasMore: false,
      };
    }

    const response: ResponseData<FullMessageResponse> =
      await new ClientApiDataSource().getMessages({
        group: { name: activeChat.name || "" },
        limit: MESSAGE_PAGE_SIZE,
        offset: 0,
        parent_message: parentMessageId,
        is_dm: activeChat.type === "direct_message",
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
   * Load previous (older) thread messages
   */
  const loadPrevious = useCallback(async (
    activeChat: ActiveChat | null,
    parentMessageId: string
  ): Promise<ChatMessagesDataWithOlder> => {
    if (!activeChat || offset >= totalCount) {
      return {
        messages: [],
        totalCount,
        hasOlder: false,
      };
    }

    const response: ResponseData<FullMessageResponse> =
      await new ClientApiDataSource().getMessages({
        group: { name: activeChat.name || "" },
        limit: MESSAGE_PAGE_SIZE,
        offset,
        parent_message: parentMessageId,
        is_dm: activeChat.type === "direct_message",
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
    clear,
  };
}

