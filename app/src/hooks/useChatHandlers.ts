import { useCallback, useRef } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ActiveChat } from "../types/Common";
import type { DMChatInfo } from "../api/clientApi";
import { getStoredSession } from "../utils/session";
import type { NotificationType } from "../utils/notificationSound";
import { log } from "../utils/logger";
import type { WebSocketEvent, ExecutionEventData } from "../types/WebSocketTypes";

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
  const lastMessageCheckRef = useRef<number>(0);
  const lastReadMessageRef = useRef<{ chatId: string; timestamp: number }>({ chatId: '', timestamp: 0 });
  
  /**
   * Handle message updates from websocket events
   */
  const handleMessageUpdates = useCallback(async (useDM: boolean) => {
    if (!activeChatRef.current) return;
    
    // Prevent concurrent message fetches
    if (isFetchingMessagesRef.current) return;
    
    // Throttle message checks to max once per 500ms (batching should handle most cases)
    const now = Date.now();
    if (now - lastMessageCheckRef.current < 500) {
      return;
    }
    lastMessageCheckRef.current = now;

    try {
      isFetchingMessagesRef.current = true;
      
      const newMessages = await mainMessages.checkForNewMessages(
        activeChatRef.current,
        useDM
      );

      if (newMessages.length > 0) {
        // Add incoming messages to trigger UI update
        mainMessages.addIncoming(newMessages);
        
        // Throttle mark-as-read calls - only once per chat per 2 seconds
        const chatId = activeChatRef.current.id || activeChatRef.current.name;
        const shouldMarkAsRead = 
          lastReadMessageRef.current.chatId !== chatId ||
          now - lastReadMessageRef.current.timestamp > 2000;
        
        if (shouldMarkAsRead) {
          lastReadMessageRef.current = { chatId, timestamp: now };
          
          // Mark messages as read (but don't await to prevent blocking)
          if (activeChat?.type === "channel") {
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.timestamp) {
              new ClientApiDataSource().readMessage({
                channel: { name: activeChat?.name },
                timestamp: lastMessage.timestamp,
              }).catch((error) => log.error("ChatHandlers", "Failed to mark message as read", error));
            }
            playSoundForMessage(lastMessage.id, 'message', false);
          } else {
            new ClientApiDataSource().readDm({
              other_user_id: activeChatRef.current?.name || "",
            }).catch((error) => log.error("ChatHandlers", "Failed to mark DM as read", error));
          }
        }
      }
    } catch (error) {
      log.error("ChatHandlers", "Error handling message updates", error);
    } finally {
      isFetchingMessagesRef.current = false;
    }
  }, [activeChat, playSoundForMessage, mainMessages, activeChatRef]);

  // Track last DM update to prevent infinite loops
  const lastDMUpdateRef = useRef<{ contextId: string; timestamp: number } | null>(null);
  
  /**
   * Handle DM-specific updates
   */
  const handleDMUpdates = useCallback(async (sessionChat: ActiveChat | null) => {
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
        if (currentDM && sessionChat.contextId) {
          lastDMUpdateRef.current = { contextId: sessionChat.contextId, timestamp: now };
          onDMSelected(currentDM, undefined, false);
        }
      }
    } catch (error) {
      log.error("ChatHandlers", "Error handling DM updates", error);
    }
  }, [fetchDms, onDMSelected]);

  /**
   * Handle execution events inside StateMutation
   * These are the specific events from the Rust backend
   */
  const handleExecutionEvents = useCallback((executionEvents: ExecutionEventData[]) => {
    // Track which actions we need to take to avoid duplicates
    let needsChannelRefresh = false;
    let needsDMRefresh = false;
    
    for (const executionEvent of executionEvents) {
      switch (executionEvent.kind) {
        case "MessageSent":
        case "MessageReceived":
          // Skip - already handled by checkForNewMessages
          break;
        case "ChannelCreated":
        case "ChannelJoined":
        case "ChannelLeft":
        case "ChannelInvited":
          needsChannelRefresh = true;
          break;
        case "DMCreated":
        case "InvitationAccepted":
        case "NewIdentityUpdated":
        case "InvitationPayloadUpdated":
          needsDMRefresh = true;
          break;
        case "ReactionUpdated":
          // Already handled by message refresh
          break;
        case "ChatInitialized":
          // Initial setup event
          break;
      }
    }
    
    // Execute actions only once per batch
    if (needsChannelRefresh) {
      debouncedFetchChannels();
    }
    if (needsDMRefresh) {
      debouncedFetchDms();
    }
  }, [debouncedFetchChannels, debouncedFetchDms]);

  /**
   * Handle state mutation events (most common websocket event)
   * StateMutation contains an array of execution events in event.data.events
   */
  const handleStateMutation = useCallback(async (event: WebSocketEvent) => {
    const sessionChat = getStoredSession();
    const useDM = (sessionChat?.type === "direct_message" &&
      sessionChat?.account &&
      !sessionChat?.canJoin &&
      sessionChat?.otherIdentityNew) as boolean;

    // Check if this StateMutation has MessageSent or MessageReceived events
    // Only fetch messages if there are actual message events
    const hasMessageEvents = event.data?.events?.some(e => 
      e.kind === 'MessageSent' || e.kind === 'MessageReceived'
    );
    
    if (hasMessageEvents) {
      // Only fetch messages if there were actual message events
      await handleMessageUpdates(useDM);
    }

    // Process specific execution events if present
    if (event.data?.events && event.data.events.length > 0) {
      handleExecutionEvents(event.data.events);
    }

    // Only refetch members for channel chats and only if relevant events occurred
    if (sessionChat?.type === "channel" && event.data?.events?.some(e => 
      e.kind === 'ChannelJoined' || e.kind === 'ChannelLeft' || e.kind === 'ChannelInvited'
    )) {
      debouncedReFetchChannelMembers();
    }
  }, [handleMessageUpdates, handleExecutionEvents, debouncedFetchDms, debouncedReFetchChannelMembers]);

  return {
    handleMessageUpdates,
    handleDMUpdates,
    handleStateMutation,
    handleExecutionEvents,
  };
}

