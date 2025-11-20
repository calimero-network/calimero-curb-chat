import { useState, useRef, useCallback } from "react";
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

/**
 * Custom hook for managing messages in a chat
 * Handles loading, pagination, and incoming messages
 */
export function useMessages() {
  const [messages, setMessages] = useState<CurbMessage[]>([]);
  const [incomingMessages, setIncomingMessages] = useState<CurbMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(MESSAGE_PAGE_SIZE);
  const [searchResults, setSearchResults] = useState<CurbMessage[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const messagesRef = useRef<CurbMessage[]>([]);

  /**
   * Load initial messages for a chat
   */
  const loadInitial = useCallback(
    async (activeChat: ActiveChat | null): Promise<ChatMessagesData> => {
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
    },
    [],
  );

  /**
   * Load previous (older) messages for pagination
   */
  const loadPrevious = useCallback(
    async (
      activeChat: ActiveChat | null,
      _chatId: string,
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
        const returnedCount = messagesArray.length;
        if (returnedCount > 0) {
          setOffset((prev) => prev + returnedCount);
        }

        const nextOffset = offset + returnedCount;
        const total = response.data.total_count;
        const hasOlder = nextOffset < total;

        return {
          messages: messagesArray,
          totalCount: total,
          hasOlder,
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
   * Check for and add new messages from websocket events
   * Fetches messages starting from the offset of already-loaded messages
   */
  const checkForNewMessages = useCallback(
    async (
      activeChat: ActiveChat | null,
      isDM: boolean,
      group: string,
      contextId: string,
    ): Promise<CurbMessage[]> => {
      if (!activeChat) return [];

      // Get the number of messages we've already loaded
      // This will be used as the offset to fetch only new messages
      const currentMessageCount = messagesRef.current.length;
      
      // If we haven't loaded any messages yet, start from offset 0
      // Otherwise, start from where we left off
      const fetchOffset = currentMessageCount;

      // If it's a DM, fetch the DM identity for this context
      let refetchIdentity: string | undefined = undefined;
      if (isDM && contextId) {
        const identityResponse = await new ClientApiDataSource().getDmIdentityByContext({
          context_id: contextId,
        });
        if (identityResponse.data) {
          refetchIdentity = identityResponse.data;
        }
      }

      const response: ResponseData<FullMessageResponse> =
        await new ClientApiDataSource().getMessages({
          group: {
            name: (isDM ? "private_dm" : group) || "",
          },
          limit: RECENT_MESSAGES_CHECK_SIZE,
          offset: fetchOffset,
          is_dm: isDM,
          dm_identity: refetchIdentity || activeChat.account,
          parent_message: undefined, // Only get main chat messages, not thread messages
        });

      if (!response.data) return [];

      // Transform messages
      const fetchedMessages = response.data.messages.map((msg) =>
        transformMessageToUI(msg),
      );

      // Get existing message IDs to filter out duplicates
      const existingMessageIds = new Set(
        messagesRef.current.map((msg) => msg.id)
      );

      // Only return messages that don't already exist
      const trulyNewMessages = fetchedMessages.filter(
        (msg) => !existingMessageIds.has(msg.id)
      );

      if (trulyNewMessages.length > 0) {
        // Only update ref with truly new messages
        messagesRef.current = [...messagesRef.current, ...trulyNewMessages];
        return trulyNewMessages;
      }

      return [];
    },
    [],
  );

  /**
   * Clear current search state
   */
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchTotalCount(0);
    setSearchOffset(0);
    setSearchQuery("");
    setSearchError(null);
  }, []);

  /**
   * Search within messages without mutating primary message state
   */
  const searchMessages = useCallback(
    async (
      activeChat: ActiveChat | null,
      query: string,
      options: { reset?: boolean; offset?: number } = {},
    ): Promise<{
      messages: CurbMessage[];
      totalCount: number;
      hasMore: boolean;
      nextOffset: number;
    }> => {
      const normalizedQuery = query.trim();
      const shouldReset = options.reset ?? false;
      const offsetOverride = options.offset;

      if (!activeChat?.name || normalizedQuery.length === 0) {
        if (shouldReset) {
          clearSearch();
          setSearchQuery(normalizedQuery);
        }
        return {
          messages: [],
          totalCount: 0,
          hasMore: false,
          nextOffset: 0,
        };
      }

      const isDM = activeChat.type === "direct_message";
      const effectiveOffset = shouldReset
        ? 0
        : offsetOverride ?? searchOffset;

      setIsSearching(true);
      setSearchError(null);

      try {
        const response: ResponseData<FullMessageResponse> =
          await new ClientApiDataSource().getMessages({
            group: { name: (isDM ? "private_dm" : activeChat.name) || "" },
            limit: MESSAGE_PAGE_SIZE,
            offset: effectiveOffset,
            is_dm: isDM,
            dm_identity: activeChat.account,
            search_term: normalizedQuery,
          });

        if (response.data) {
          const transformed = transformMessagesToUI(response.data.messages).reverse();
          setSearchResults((prev) =>
            shouldReset ? transformed : [...prev, ...transformed],
          );
          setSearchTotalCount(response.data.total_count);
          setSearchOffset(effectiveOffset + transformed.length);
          setSearchQuery(normalizedQuery);

          const hasMore =
            effectiveOffset + transformed.length < response.data.total_count;

          return {
            messages: transformed,
            totalCount: response.data.total_count,
            hasMore,
            nextOffset: effectiveOffset + transformed.length,
          };
        }

        if (shouldReset) {
          clearSearch();
          setSearchQuery(normalizedQuery);
        }

        return {
          messages: [],
          totalCount: 0,
          hasMore: false,
          nextOffset: effectiveOffset,
        };
      } catch (error) {
        console.error("searchMessages failed:", error);
        setSearchError(
          error instanceof Error ? error.message : "Search failed",
        );
        if (shouldReset) {
          clearSearch();
          setSearchQuery(normalizedQuery);
        }
        return {
          messages: [],
          totalCount: 0,
          hasMore: false,
          nextOffset: effectiveOffset,
        };
      } finally {
        setIsSearching(false);
      }
    },
    [clearSearch, searchOffset],
  );

  /**
   * Add incoming messages (from websocket)
   * MessageStore handles deduplication of optimistic messages
   */
  const addIncoming = useCallback((newMessages: CurbMessage[]) => {
    if (newMessages.length > 0) {
      // Pass to VirtualizedChat - MessageStore handles deduplication
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
    // MessageStore will handle deduplication when real message arrives
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
    clearSearch();
  }, [clearSearch]);

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
    searchResults,
    searchTotalCount,
    searchOffset,
    searchQuery,
    isSearching,
    searchError,
    searchMessages,
    clearSearch,
  };
}
