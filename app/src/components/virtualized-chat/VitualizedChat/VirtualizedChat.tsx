import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { ListRange, VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import styled from 'styled-components';

import DefaultNewMessageIndicator from './DefaultNewMessagesIndicator';
import type { UpdateDescriptor } from './MessageStore';
import MessageStore from './MessageStore';
import NoMessages from './NoMessages';
import { OverlayDiv } from './OverlayDiv';
import { log } from '../../../utils/logger';

const VirtuosoWrapper = styled.div`
  scrollbar-color: black transparent;
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-thumb {
    background-color: black;
    border-radius: 6px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: black;
  }
  * {
    scrollbar-color: black transparent;
  }
  html::-webkit-scrollbar {
    width: 12px;
  }
  html::-webkit-scrollbar-thumb {
    background-color: black;
    border-radius: 6px;
  }
  html::-webkit-scrollbar-thumb:hover {
    background-color: black;
  }
`;

interface Message {
  id: string;
  timestamp: number;
}

interface NewMessageIndicatorProps {
  onClick: () => void;
}

export interface VirtualizedChatProps<T extends Message> {
  loadPrevMessages: (
    id: string,
  ) => Promise<{ messages: T[]; hasOlder: boolean }>;
  loadInitialMessages: () => Promise<{ messages: T[]; totalCount: number }>;
  incomingMessages?: T[];
  updatedMessages?: { id: string; descriptor: UpdateDescriptor<T> }[];
  render: (item: T, prevItem?: T) => React.ReactElement;
  newMessageIndicator?: React.ComponentType<NewMessageIndicatorProps>;
  onItemNewItemRender?: (item: T) => void;
  style?: React.CSSProperties;
  chatId: string;
  shouldTriggerNewItemIndicator?: (item: T) => boolean;
}

const VirtualizedChat = <T extends Message>({
  loadPrevMessages,
  loadInitialMessages,
  incomingMessages = [],
  updatedMessages = [],
  render,
  newMessageIndicator = DefaultNewMessageIndicator,
  onItemNewItemRender,
  shouldTriggerNewItemIndicator,
  style,
  chatId,
}: VirtualizedChatProps<T>): React.ReactElement => {
  const [messages, setMessages] = useState<T[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [firstItemIndex, setFirstItemIndex] = useState<number>(10000);
  const [totalCount, setTotalCount] = useState<number>(10000);
  const listHandler = useRef<VirtuosoHandle>(null);
  const [hasNewMessages, setHasNewMessages] = useState<boolean>(false);
  const [oldestMessagerReported, setOldestMessageReported] =
    useState<number>(-1);

  const store = useRef(new MessageStore<T>()).current;
  const isScrolling = useRef<boolean>(false);
  const isAtBottom = useRef<boolean>(true);

  const isInitialLoadingRef = useRef<boolean>(false);
  const hasScrolledToBottomRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettlingRef = useRef<boolean>(false); // Prevent jumping during initial settling period

  const scrollToBottom = (): void => {
    listHandler.current?.scrollToIndex({ index: 'LAST' });
  };

  const fetchInitialMessages = async () => {
    // TODO:  This is a hack to prevent multiple initial fetches between re-renders
    // caused by the component being unmounted and remounted during the
    // initial fetch. Need to find a better way to do this.
    isInitialLoadingRef.current = true;
    setIsLoadingInitial(true);
    setOldestMessageReported(-1);
    hasScrolledToBottomRef.current = false;
    isSettlingRef.current = false; // Reset settling flag for new chat
    
    // Clear any pending scroll timeouts from previous chat
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    try {
      const initialMessagesResponse = await loadInitialMessages();
      const { messages: initialMessages, totalCount: totalItems } =
        initialMessagesResponse || {};

      store.initial(initialMessages);
      setMessages(store.messages);
      setHasMore(totalItems > initialMessages.length);
      setFirstItemIndex(totalItems - initialMessages.length);
      setTotalCount(totalItems);
      
    } catch (error) {
      log.error('VirtualizedChat', 'Failed to load initial messages', error);
    } finally {
      // Set loading to false to render the list
      // The useEffect will handle scrolling after render
      setIsLoadingInitial(false);
      isInitialLoadingRef.current = false;
    }
  };

  const reportLastRenderedItem = (range: ListRange) => {
    if (onItemNewItemRender && range.endIndex > oldestMessagerReported) {
      const lastItem = store.getItem(range.endIndex - firstItemIndex);
      onItemNewItemRender(lastItem);
      setOldestMessageReported(range.endIndex);
    }
  };

  const handleFollowOutput = useCallback((atBottom: boolean) => {
    // During the initial settling period (first ~1 second after load),
    // disable followOutput to prevent jumping as heights are calculated
    if (isSettlingRef.current) {
      return false;
    }
    
    // Only auto-scroll to bottom if:
    // 1. User is already at the bottom
    // 2. User is not actively scrolling
    // This prevents jumping back to bottom when user is reading older messages
    if (atBottom && !isScrolling.current && isAtBottom.current) {
      return 'smooth';
    }
    return false;
  }, []);

  useEffect(() => {
    if (chatId && !isInitialLoadingRef.current) {
      fetchInitialMessages();
    }
  }, [chatId]);
  
  // Simplified scroll to bottom - only once after initial load
  useEffect(() => {
    if (!isLoadingInitial && messages.length > 0 && !hasScrolledToBottomRef.current) {
      // Mark as settling to prevent followOutput from interfering
      isSettlingRef.current = true;
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Wait a bit longer for initial render to stabilize
      scrollTimeoutRef.current = setTimeout(() => {
        if (listHandler.current && !hasScrolledToBottomRef.current) {
          log.debug('VirtualizedChat', `Scrolling to bottom for chat ${chatId} with ${messages.length} messages`);
          listHandler.current.scrollToIndex({ 
            index: 'LAST',
            align: 'end',
            behavior: 'auto'
          });
          hasScrolledToBottomRef.current = true;
          
          // Keep settling flag active for a bit longer to prevent jumping
          // as message heights are still being calculated
          setTimeout(() => {
            isSettlingRef.current = false;
            log.debug('VirtualizedChat', 'Settling period complete');
          }, 1000); // Additional 1 second settling period
        }
      }, 150); // Increased from 50ms to 150ms to let DOM stabilize
      
      // Cleanup timeout on unmount
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        isSettlingRef.current = false;
      };
    }
  }, [isLoadingInitial, messages.length, chatId]);

  useEffect(() => {
    if (incomingMessages.length > 0) {
      const { addedCount, updatedCount } = store.append(incomingMessages);
      
      // Update state if we added OR updated messages
      // We need to call setMessages even for updates because React won't detect
      // mutations to the store.messages array
      if (addedCount > 0 || updatedCount > 0) {
        setMessages([...store.messages]); // Create new array reference to trigger re-render
        
        if (addedCount > 0) {
          setTotalCount((prevTotalCount) => prevTotalCount + addedCount);
        }
        
        // If user is not at bottom and we received new messages,
        // show the new message indicator instead of auto-scrolling
        if (
          addedCount > 0 &&
          !isAtBottom.current &&
          (shouldTriggerNewItemIndicator
            ? shouldTriggerNewItemIndicator(
                store.messages[store.messages.length - 1],
              )
            : true)
        ) {
          setHasNewMessages(true);
          log.debug('VirtualizedChat', 'New messages received while not at bottom, showing indicator');
        }
      }
    }
  }, [incomingMessages, shouldTriggerNewItemIndicator, store]);

  useEffect(() => {
    if (updatedMessages.length > 0) {
      store.updateMultiple(updatedMessages);
      // Force re-render by creating new array reference
      // This is necessary because MessageStore mutates the array internally
      setMessages([...store.messages]);
    }
  }, [updatedMessages, store]);

  const handleLoadMore = useCallback(async () => {
    if (!isLoadingOlder && hasMore && !isLoadingInitial) {
      setIsLoadingOlder(true);

      const oldestMessageId = messages[0]?.id;

      if (oldestMessageId) {
        const { messages: olderMessages, hasOlder: olderHasMore } =
          await loadPrevMessages(messages[0].id);

        if (olderMessages.length > 0) {
          setFirstItemIndex(
            (prevFirstItemIndex) => prevFirstItemIndex - olderMessages.length,
          );
          store.prepend(olderMessages);
          setMessages(store.messages);
        }
        setHasMore(olderHasMore);
      } else {
        setHasMore(false);
      }
      setIsLoadingOlder(false);
    }
  }, [loadPrevMessages, isLoadingOlder, hasMore, messages, isLoadingInitial]);

  const handleRenderItem = useCallback(
    (index: number, item: T) => {
      // Calculate the actual index in the messages array
      // Virtuoso uses firstItemIndex offset, so we need to adjust
      const actualIndex = index - firstItemIndex;
      // Use store.messages instead of messages state to get the most up-to-date data
      const currentMessages = store.messages;
      const prevMessage = actualIndex > 0 ? currentMessages[actualIndex - 1] : undefined;
      
      return render(item, prevMessage);
    },
    [render, firstItemIndex, store],
  );

  // Memoize callbacks to prevent re-creating functions on every render
  const handleEndReached = useCallback(() => {
    setHasNewMessages(false);
  }, []);

  const handleIsScrolling = useCallback((scrolling: boolean) => {
    isScrolling.current = scrolling;
    
    // If user starts scrolling, they're intentionally navigating
    // Mark that we shouldn't auto-scroll them back
    if (scrolling) {
      // User is actively scrolling, respect their intent
      log.debug('VirtualizedChat', 'User is scrolling, disabling auto-scroll');
    }
  }, []);

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    const wasAtBottom = isAtBottom.current;
    isAtBottom.current = atBottom;
    
    // Log state changes for debugging
    if (wasAtBottom !== atBottom) {
      log.debug('VirtualizedChat', `Bottom state changed: ${wasAtBottom} -> ${atBottom}`);
    }
  }, []);

  // Memoize static objects to prevent re-creating on every render
  const virtuosoStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);
  // Reduced overscan from 500 to 200 to reduce off-screen rendering and jumping
  const overscanConfig = useMemo(() => ({ reverse: 200, main: 100 }), []);
  // Reduced viewport buffer to minimize layout shifts
  const viewportConfig = useMemo(() => ({ top: 100, bottom: 100 }), []);

  const NewMessageIndicator = React.createElement(newMessageIndicator, {
    onClick: scrollToBottom,
  });

  return (
    <VirtuosoWrapper style={{ position: 'relative', ...style }}>
      {isLoadingInitial && <OverlayDiv type="loading" />}
      {!isLoadingInitial && messages?.length === 0 && <NoMessages />}
      {hasNewMessages && NewMessageIndicator}
      {!isLoadingInitial && messages.length > 0 && (
        <Virtuoso
          key={chatId}
          style={virtuosoStyle}
          itemContent={handleRenderItem}
          computeItemKey={(_, item) => store.computeKey(item)}
          followOutput={handleFollowOutput}
          data={messages}
          alignToBottom
          initialTopMostItemIndex={messages.length - 1}
          startReached={handleLoadMore}
          endReached={handleEndReached}
          rangeChanged={reportLastRenderedItem}
          firstItemIndex={firstItemIndex}
          totalCount={totalCount}
          isScrolling={handleIsScrolling}
          atBottomStateChange={handleAtBottomStateChange}
          atBottomThreshold={100}
          ref={listHandler}
          overscan={overscanConfig}
          increaseViewportBy={viewportConfig}
          defaultItemHeight={100}
          skipAnimationFrameInResizeObserver={true}
        />
      )}
    </VirtuosoWrapper>
  );
};

export default VirtualizedChat;
