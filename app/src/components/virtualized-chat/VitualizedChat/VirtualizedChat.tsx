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

  const handleFollowOutput = (atBottom: boolean) => {
    if (atBottom && !isScrolling.current) {
      return 'smooth';
    }
    return false;
  };

  useEffect(() => {
    if (chatId && !isInitialLoadingRef.current) {
      fetchInitialMessages();
    }
  }, [chatId]);
  
  // Ensure scroll to bottom after messages are loaded and component is rendered
  useEffect(() => {
    if (!isLoadingInitial && messages.length > 0) {
      // Multiple scroll attempts with increasing delays to ensure it works
      const scrollAttempts = [50, 100, 200, 400];
      
      scrollAttempts.forEach((delay) => {
        setTimeout(() => {
          if (listHandler.current) {
            log.debug('VirtualizedChat', `Scroll attempt at ${delay}ms for chat ${chatId}`);
            listHandler.current.scrollToIndex({ 
              index: messages.length - 1,
              align: 'end',
              behavior: 'auto'
            });
          }
        }, delay);
      });
    }
  }, [isLoadingInitial, chatId]);

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
        }
      }
    }
  }, [incomingMessages]);

  useEffect(() => {
    store.updateMultiple(updatedMessages);
    setMessages([...store.messages]); // TODO: Spread operator is a hack to force a re-render
  }, [updatedMessages]);

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
  }, []);

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    isAtBottom.current = atBottom;
  }, []);

  // Memoize static objects to prevent re-creating on every render
  const virtuosoStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);
  const overscanConfig = useMemo(() => ({ reverse: 500, main: 0 }), []);
  const viewportConfig = useMemo(() => ({ top: 200, bottom: 200 }), []);

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
          startReached={handleLoadMore}
          endReached={handleEndReached}
          rangeChanged={reportLastRenderedItem}
          firstItemIndex={firstItemIndex}
          totalCount={totalCount}
          isScrolling={handleIsScrolling}
          atBottomStateChange={handleAtBottomStateChange}
          ref={listHandler}
          overscan={overscanConfig}
          increaseViewportBy={viewportConfig}
        />
      )}
    </VirtuosoWrapper>
  );
};

export default VirtualizedChat;
