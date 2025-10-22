import { useState, useRef, useEffect, useCallback } from 'react';
import MessageStore from '../MessageStore';
import { log } from '../../../../utils/logger';

interface Message {
  id: string;
  timestamp: number;
}

interface UseMessageLoaderProps<T extends Message> {
  chatId: string;
  loadInitialMessages: () => Promise<{ messages: T[]; totalCount: number }>;
  loadPrevMessages: (id: string) => Promise<{ messages: T[]; hasOlder: boolean }>;
  store: MessageStore<T>;
  onLoadComplete?: () => void;
}

interface UseMessageLoaderReturn<T extends Message> {
  messages: T[];
  isLoadingInitial: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  firstItemIndex: number;
  totalCount: number;
  handleLoadMore: () => Promise<void>;
  updateMessages: (newMessages: T[], addedCount?: number) => void;
}

export function useMessageLoader<T extends Message>({
  chatId,
  loadInitialMessages,
  loadPrevMessages,
  store,
  onLoadComplete,
}: UseMessageLoaderProps<T>): UseMessageLoaderReturn<T> {
  const [messages, setMessages] = useState<T[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [firstItemIndex, setFirstItemIndex] = useState<number>(10000);
  const [totalCount, setTotalCount] = useState<number>(10000);
  
  const isInitialLoadingRef = useRef<boolean>(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep refs updated to avoid including callbacks in dependency arrays
  const onLoadCompleteRef = useRef(onLoadComplete);
  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
  });

  const fetchInitialMessages = useCallback(async () => {
    if (isInitialLoadingRef.current) return;
    
    isInitialLoadingRef.current = true;
    setIsLoadingInitial(true);

    try {
      const { messages: initialMessages, totalCount: totalItems } = 
        await loadInitialMessages();

      store.initial(initialMessages);
      setMessages(store.messages);
      setHasMore(totalItems > initialMessages.length);
      setFirstItemIndex(totalItems - initialMessages.length);
      setTotalCount(totalItems);
    } catch (error) {
      log.error('useMessageLoader', 'Failed to load initial messages', error);
    } finally {
      setIsLoadingInitial(false);
      isInitialLoadingRef.current = false;
      onLoadCompleteRef.current?.();
    }
  }, [loadInitialMessages, store]);

  const handleLoadMore = useCallback(async () => {
    // Prevent concurrent loads and respect loading state
    if (isLoadingOlder || !hasMore || isLoadingInitial || messages.length === 0) {
      return;
    }

    // Clear any pending timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    setIsLoadingOlder(true);
    const oldestMessageId = messages[0]?.id;

    if (!oldestMessageId) {
      setHasMore(false);
      setIsLoadingOlder(false);
      return;
    }

    try {
      const { messages: olderMessages, hasOlder: olderHasMore } =
        await loadPrevMessages(oldestMessageId);

      if (olderMessages.length > 0) {
        // Following Virtuoso best practice: update index first, then prepend
        // This maintains scroll position better (similar to scrollModifier: 'prepend')
        setFirstItemIndex((prev) => prev - olderMessages.length);
        store.prepend(olderMessages);
        
        // Batch the state update to prevent render during scroll
        setMessages([...store.messages]);
      }
      setHasMore(olderHasMore);
    } catch (error) {
      log.error('useMessageLoader', 'Failed to load older messages', error);
    } finally {
      // Small delay before allowing next load to prevent rapid triggering
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoadingOlder(false);
      }, 200);
    }
  }, [
    loadPrevMessages,
    isLoadingOlder,
    hasMore,
    messages,
    isLoadingInitial,
    store,
  ]);

  const updateMessages = useCallback((newMessages: T[], addedCount: number = 0) => {
    setMessages(newMessages);
    if (addedCount > 0) {
      setTotalCount((prev) => prev + addedCount);
    }
  }, []);

  useEffect(() => {
    if (chatId && !isInitialLoadingRef.current) {
      fetchInitialMessages();
    }
  }, [chatId, fetchInitialMessages]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages,
    isLoadingInitial,
    isLoadingOlder,
    hasMore,
    firstItemIndex,
    totalCount,
    handleLoadMore,
    updateMessages,
  };
}

