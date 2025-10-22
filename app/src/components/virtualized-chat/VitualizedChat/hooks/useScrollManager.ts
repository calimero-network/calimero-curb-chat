import { useState, useRef, useCallback, useEffect } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import { log } from '../../../../utils/logger';

interface UseScrollManagerProps {
  chatId: string;
  isLoadingInitial: boolean;
  messageCount: number;
}

interface UseScrollManagerReturn {
  listRef: React.RefObject<VirtuosoHandle | null>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
  handleFollowOutput: (atBottom: boolean) => 'smooth' | false;
  handleIsScrolling: (scrolling: boolean) => void;
  handleAtBottomStateChange: (atBottom: boolean) => void;
  hasScrolledToBottom: boolean;
  resetScrollAwayFlag: () => void; // Expose to allow parent to reset
}

export function useScrollManager({
  chatId,
  isLoadingInitial,
  messageCount,
}: UseScrollManagerProps): UseScrollManagerReturn {
  const listRef = useRef<VirtuosoHandle>(null);
  const isScrollingRef = useRef<boolean>(false);
  const isAtBottomRef = useRef<boolean>(true);
  const hasScrolledToBottomRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettlingRef = useRef<boolean>(false);
  const userHasScrolledAwayRef = useRef<boolean>(false); // Track if user intentionally left bottom
  
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  const clearScrollTimeout = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  const resetScrollAwayFlag = useCallback(() => {
    userHasScrolledAwayRef.current = false;
  }, []);

  const scrollToBottom = useCallback((): void => {
    // When user explicitly scrolls to bottom (like clicking button or sending message)
    // Reset the scroll-away flag to re-enable auto-scroll
    resetScrollAwayFlag();
    listRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
  }, [resetScrollAwayFlag]);

  const handleFollowOutput = useCallback((atBottom: boolean) => {
    // During settling, don't auto-scroll
    if (isSettlingRef.current) {
      return false;
    }
    
    // Following VirtuosoMessageList pattern: auto-scroll-to-bottom modifier
    // If user has scrolled away but we're receiving new content
    // Only scroll if we're already at bottom OR if the scroll-away flag is not set
    if (userHasScrolledAwayRef.current && !atBottom) {
      return false; // Don't scroll if user has left bottom
    }
    
    // Auto-scroll if at bottom or if scroll-away flag was just reset (by sending message)
    if ((atBottom || !userHasScrolledAwayRef.current) && !isScrollingRef.current && isAtBottomRef.current) {
      return 'smooth';
    }
    return false;
  }, []);

  const handleIsScrolling = useCallback((scrolling: boolean) => {
    isScrollingRef.current = scrolling;
    
    // If user starts scrolling after initial load, they're intentionally navigating
    if (scrolling && hasScrolledToBottomRef.current) {
      isSettlingRef.current = false;
      // Mark that user has taken control of scroll
      userHasScrolledAwayRef.current = true;
      log.debug('useScrollManager', 'User is scrolling - disabled auto-scroll');
    }
  }, []);

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    const wasAtBottom = isAtBottomRef.current;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    
    // If user manually scrolls away from bottom after initial load
    if (!atBottom && wasAtBottom && hasScrolledToBottomRef.current) {
      isSettlingRef.current = false;
      userHasScrolledAwayRef.current = true;
      log.debug('useScrollManager', 'User scrolled away from bottom');
    }
    
    // If user scrolls back to bottom manually, reset the flag
    if (atBottom && !wasAtBottom) {
      userHasScrolledAwayRef.current = false;
      log.debug('useScrollManager', 'User returned to bottom');
    }
    
    if (wasAtBottom !== atBottom) {
      log.debug('useScrollManager', `Bottom state changed: ${wasAtBottom} -> ${atBottom}`);
    }
  }, []);

  // Reset on chat change
  useEffect(() => {
    hasScrolledToBottomRef.current = false;
    isSettlingRef.current = false;
    userHasScrolledAwayRef.current = false; // Reset scroll-away flag
    clearScrollTimeout();
  }, [chatId, clearScrollTimeout]);

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!isLoadingInitial && messageCount > 0 && !hasScrolledToBottomRef.current) {
      isSettlingRef.current = true;
      clearScrollTimeout();
      
      scrollTimeoutRef.current = setTimeout(() => {
        if (listRef.current && !hasScrolledToBottomRef.current) {
          log.debug('useScrollManager', `Scrolling to bottom for chat ${chatId}`);
          listRef.current.scrollToIndex({ 
            index: 'LAST',
            align: 'end',
            behavior: 'auto'
          });
          hasScrolledToBottomRef.current = true;
          
          // Longer settling period to allow user to start scrolling
          setTimeout(() => {
            isSettlingRef.current = false;
            log.debug('useScrollManager', 'Settling period complete');
          }, 2000); // Increased from 1s to 2s
        }
      }, 150);
      
      return clearScrollTimeout;
    }
  }, [isLoadingInitial, messageCount, chatId, clearScrollTimeout]);

  return {
    listRef,
    isAtBottom,
    scrollToBottom,
    handleFollowOutput,
    handleIsScrolling,
    handleAtBottomStateChange,
    hasScrolledToBottom: hasScrolledToBottomRef.current,
    resetScrollAwayFlag,
  };
}

