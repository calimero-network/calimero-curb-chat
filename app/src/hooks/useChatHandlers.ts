import { useCallback, useRef } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ActiveChat } from "../types/Common";
import type { DMChatInfo } from "../api/clientApi";
import { getStoredSession } from "../utils/session";
import type { NotificationType } from "../utils/notificationSound";

/**
 * Custom hook for handling chat-related events (messages, DMs, channels)
 * Extracted from Home component to reduce complexity
 */
export function useChatHandlers(
  activeChatRef: React.RefObject<ActiveChat | null>,
  activeChat: ActiveChat | null,
  mainMessages: {
    checkForNewMessages: (chat: ActiveChat, isDM: boolean) => Promise<any[]>;
    addIncoming: (messages: any[]) => void;
  },
  playSoundForMessage: (messageId: string, type?: NotificationType, isMention?: boolean) => void,
  fetchDms: () => Promise<DMChatInfo[] | undefined>,
  onDMSelected: (dm?: DMChatInfo, sc?: ActiveChat, refetch?: boolean) => void,
  debouncedFetchChannels: () => void,
  debouncedFetchDms: () => void,
  debouncedReFetchChannelMembers: () => void
) {
  // Track if we're already fetching messages to prevent concurrent calls
  const isFetchingMessagesRef = useRef(false);
  
  /**
   * Handle message updates from websocket events
   */
  const handleMessageUpdates = useCallback(async (useDM: boolean) => {
    if (!activeChatRef.current) return;
    
    // Prevent concurrent message fetches
    if (isFetchingMessagesRef.current) return;

    try {
      isFetchingMessagesRef.current = true;
      
      const newMessages = await mainMessages.checkForNewMessages(
        activeChatRef.current,
        useDM
      );

      if (newMessages.length > 0) {
        // Add incoming messages to trigger UI update
        mainMessages.addIncoming(newMessages);
        
        // Mark messages as read (but don't await to prevent blocking)
        if (activeChat?.type === "channel") {
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.timestamp) {
            new ClientApiDataSource().readMessage({
              channel: { name: activeChat?.name },
              timestamp: lastMessage.timestamp,
            }).catch(console.error);
          }
          playSoundForMessage(lastMessage.id, 'message', false);
        } else {
          new ClientApiDataSource().readDm({
            other_user_id: activeChatRef.current?.name || "",
          }).catch(console.error);
        }
      }
    } catch (error) {
      console.error("Error handling message updates:", error);
    } finally {
      isFetchingMessagesRef.current = false;
    }
  }, [activeChat, playSoundForMessage, mainMessages, activeChatRef]);

  // Track last DM update to prevent infinite loops
  const lastDMUpdateRef = useRef<{ contextId: string; timestamp: number } | null>(null);
  
  /**
   * Handle DM-specific updates
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDMUpdates = useCallback(async (sessionChat: any) => {
    if (sessionChat?.type !== "direct_message") return;

    // Prevent rapid re-processing of the same DM
    const now = Date.now();
    if (
      lastDMUpdateRef.current &&
      lastDMUpdateRef.current.contextId === sessionChat.contextId &&
      now - lastDMUpdateRef.current.timestamp < 2000 // 2 second cooldown
    ) {
      return;
    }

    try {
      const updatedDMs = await fetchDms();
      
      if (
        !sessionChat?.isFinal &&
        updatedDMs?.length &&
        (sessionChat?.canJoin ||
          !sessionChat?.isSynced ||
          !sessionChat?.account ||
          !sessionChat?.otherIdentityNew)
      ) {
        const currentDM = updatedDMs.find(
          (dm) => dm.context_id === sessionChat.contextId
        );
        
        // Only call onDMSelected if we actually found a matching DM
        if (currentDM) {
          lastDMUpdateRef.current = { contextId: sessionChat.contextId, timestamp: now };
          onDMSelected(currentDM, undefined, false);
        }
      }
    } catch (error) {
      console.error("Error handling DM updates:", error);
    }
  }, [fetchDms, onDMSelected]);

  /**
   * Handle state mutation events (most common websocket event)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStateMutation = useCallback(async (_event: any) => {
    const sessionChat = getStoredSession();
    const useDM = (sessionChat?.type === "direct_message" &&
      sessionChat?.account &&
      !sessionChat?.canJoin &&
      sessionChat?.otherIdentityNew) as boolean;

    // Only fetch messages for the current active chat - most common operation
    await handleMessageUpdates(useDM);

    // Update channels list (debounced to avoid spam)
    debouncedFetchChannels();

    // Handle DM updates (includes fetching DMs list)
    // For DMs, don't call handleDMUpdates on every event - it triggers cascading updates
    // Only refetch DM list (debounced)
    if (sessionChat?.type === "direct_message") {
      debouncedFetchDms();
    } else {
      // Only update DM list if not currently in a DM
      debouncedFetchDms();
      // Only refetch members for channel chats (debounced to prevent spam)
      debouncedReFetchChannelMembers();
    }
  }, [debouncedFetchChannels, debouncedFetchDms, handleMessageUpdates, debouncedReFetchChannelMembers]);

  /**
   * Handle execution events (channel created, message sent, etc.)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleExecutionEvent = useCallback(async (event: any) => {
    if (!event.data?.events || event.data.events.length === 0) {
      return;
    }

    const executionEvents = event.data.events;
    
    for (const executionEvent of executionEvents) {
      switch (executionEvent.kind) {
        case "MessageSent":
          // On sender node do nothing as this will only duplicate the message
          break;
        case "ChannelCreated":
          debouncedFetchChannels();
          break;
      }
    }
  }, [debouncedFetchChannels]);

  return {
    handleMessageUpdates,
    handleDMUpdates,
    handleStateMutation,
    handleExecutionEvent,
  };
}

