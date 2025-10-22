import { useEffect, useRef } from 'react';
import MessageStore from '../MessageStore';
import type { UpdateDescriptor } from '../MessageStore';
import { log } from '../../../../utils/logger';

interface Message {
  id: string;
  timestamp: number;
}

interface UseMessageUpdatesProps<T extends Message> {
  incomingMessages: T[];
  updatedMessages: { id: string; descriptor: UpdateDescriptor<T> }[];
  store: MessageStore<T>;
  isAtBottom: boolean;
  shouldTriggerNewItemIndicator?: (item: T) => boolean;
  onMessagesUpdated: (messages: T[], addedCount: number) => void;
  onNewMessagesWhileNotAtBottom: () => void;
}

export function useMessageUpdates<T extends Message>({
  incomingMessages,
  updatedMessages,
  store,
  isAtBottom,
  shouldTriggerNewItemIndicator,
  onMessagesUpdated,
  onNewMessagesWhileNotAtBottom,
}: UseMessageUpdatesProps<T>): void {
  // Use refs to avoid adding callbacks to dependency arrays (prevents render loops)
  const onMessagesUpdatedRef = useRef(onMessagesUpdated);
  const onNewMessagesWhileNotAtBottomRef = useRef(onNewMessagesWhileNotAtBottom);
  
  // Keep refs updated
  useEffect(() => {
    onMessagesUpdatedRef.current = onMessagesUpdated;
    onNewMessagesWhileNotAtBottomRef.current = onNewMessagesWhileNotAtBottom;
  });

  // Handle incoming messages
  // Following VirtuosoMessageList pattern: distinguish between appending new messages vs updating existing
  // Reference: https://virtuoso.dev/virtuoso-message-list/tutorial/loading-older-messages/
  useEffect(() => {
    if (incomingMessages.length === 0) return;

    const { addedCount, updatedCount } = store.append(incomingMessages);
    
    if (addedCount > 0 || updatedCount > 0) {
      onMessagesUpdatedRef.current([...store.messages], addedCount);
      
      // Pattern from VirtuosoMessageList: distinguish between sent vs received messages
      // shouldTriggerNewItemIndicator returns FALSE for own messages
      if (addedCount > 0) {
        const lastMessage = store.messages[store.messages.length - 1];
        const isOwnMessage = shouldTriggerNewItemIndicator 
          ? !shouldTriggerNewItemIndicator(lastMessage)  // Inverted - returns FALSE for own messages
          : false;

        // If it's our own message (sending), show indicator only if not at bottom
        // If it's someone else's message (receiving), show indicator only if not at bottom
        if (!isAtBottom) {
          const shouldShow = shouldTriggerNewItemIndicator 
            ? shouldTriggerNewItemIndicator(lastMessage)
            : true;
          
          if (shouldShow) {
            onNewMessagesWhileNotAtBottomRef.current();
            log.debug('useMessageUpdates', 'New messages from others - showing indicator');
          }
        }
        
        // Note: followOutput in useScrollManager will handle auto-scroll for own messages
      }
      // For updates (reactions, edits) - don't show indicator
      // This follows the 'items-change' modifier pattern
    }
  }, [incomingMessages, store, isAtBottom, shouldTriggerNewItemIndicator]);

  // Handle updated messages (reactions, edits, deletes)
  // Following 'items-change' pattern from VirtuosoMessageList
  // These don't add new items, just modify existing ones
  useEffect(() => {
    if (updatedMessages.length === 0) return;

    store.updateMultiple(updatedMessages);
    // Pass 0 for addedCount - this is an update, not new messages
    onMessagesUpdatedRef.current([...store.messages], 0);
  }, [updatedMessages, store]);
}

