import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import AppContainer from "../../components/common/AppContainer";
import {
  MessageStatus,
  type ActiveChat,
  type ChannelMeta,
  type ChatMessagesData,
  type ChatMessagesDataWithOlder,
  type ChatType,
  type CurbMessage,
} from "../../types/Common";
import {
  getDmContextId,
  getStoredSession,
  setDmContextId,
  updateSessionChat,
} from "../../utils/session";
import { defaultActiveChat } from "../../mock/mock";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
import {
  type ResponseData,
  apiClient,
  getContextId,
  getExecutorPublicKey,
  useCalimero,
} from "@calimero-network/calimero-client";
import {
  type Channels,
  type DMChatInfo,
  type FullMessageResponse,
  type UserId,
} from "../../api/clientApi";
import type { MessageWithReactions } from "../../api/clientApi";
import type { CreateContextResult } from "../../components/popups/StartDMPopup";
import { generateDMParams } from "../../utils/dmSetupState";
import useNotificationSound from "../../hooks/useNotificationSound";
import { transformMessagesToUI, getNewMessages } from "../../utils/messageTransformers";
import {
  MESSAGE_PAGE_SIZE,
  RECENT_MESSAGES_CHECK_SIZE,
  DEBOUNCE_FETCH_DELAY_MS,
  EVENT_RATE_LIMIT_MS,
  EVENT_QUEUE_MAX_SIZE,
  EVENT_QUEUE_CLEANUP_SIZE,
  SUBSCRIPTION_INIT_DELAY_MS,
} from "../../constants/app";
import { debounce } from "../../utils/debounce";
import { useChannels } from "../../hooks/useChannels";
import { useDMs } from "../../hooks/useDMs";
import { useChatMembers } from "../../hooks/useChatMembers";
import { useChannelMembers } from "../../hooks/useChannelMembers";
import { useMessages } from "../../hooks/useMessages";
import { useThreadMessages } from "../../hooks/useThreadMessages";
import { useWebSocketSubscription } from "../../hooks/useWebSocketSubscription";
import { useChatHandlers } from "../../hooks/useChatHandlers";

export default function Home({ isConfigSet }: { isConfigSet: boolean }) {
  const { app } = useCalimero();
  const [isOpenSearchChannel, setIsOpenSearchChannel] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [currentOpenThread, setCurrentOpenThread] = useState<
    CurbMessage | undefined
  >(undefined);
  const activeChatRef = useRef<ActiveChat | null>(null);
  const currentOpenThreadRef = useRef<CurbMessage | undefined>(undefined);
  const [openThread, setOpenThread] = useState<CurbMessage | undefined>(
    undefined
  );
  
  // Ref for subscription to avoid circular dependency
  const subscriptionRef = useRef<{ subscribe: (contextId: string) => void } | null>(null);

  // Use message hooks for cleaner message management
  const mainMessages = useMessages();
  const threadMessages = useThreadMessages();

  const { playSoundForMessage, playSound } = useNotificationSound(
    {
      enabled: false, // Start disabled - user needs to enable in settings
      volume: 0.5,
      respectFocus: true,
      respectMute: true,
    },
    activeChat?.id
  );

  // Use custom hooks for data management
  const channelsHook = useChannels();
  const dmsHook = useDMs(playSoundForMessage);
  const chatMembersHook = useChatMembers();
  const channelMembersHook = useChannelMembers();
  
  // Expose for compatibility with existing code
  const messagesRef = mainMessages.messagesRef;
  const incomingMessages = mainMessages.incomingMessages;
  const addOptimisticMessage = mainMessages.addOptimistic;

  // Initialize audio context on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      playSound('message'); // This will initialize the audio context
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [playSound]);

  // Refs to prevent infinite loops and track processing state
  const isProcessingEvent = useRef(false);
  const lastEventTime = useRef(0);
  const eventQueue = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isConfigSet) {
      window.location.href = "/login";
    }
  }, [isConfigSet]);

  useEffect(() => {
    currentOpenThreadRef.current = currentOpenThread;
  }, [currentOpenThread]);

  // Use channel members hook
  const getChannelUsers = channelMembersHook.fetchChannelMembers;
  const getNonInvitedUsers = channelMembersHook.fetchNonInvitedUsers;

  const reFetchChannelMembers = useCallback(async () => {
    const isDM = activeChatRef.current?.type === "direct_message";
    await getChannelUsers(
      (isDM ? "private_dm" : activeChatRef.current?.id) || ""
    );
  }, [getChannelUsers, activeChatRef]);
  
  // Debounce channel members refetch to avoid overwhelming the server
  const debouncedReFetchChannelMembers = useMemo(
    () => debounce(() => {
      reFetchChannelMembers();
    }, DEBOUNCE_FETCH_DELAY_MS),
    [reFetchChannelMembers]
  );

  // Track last chat to prevent duplicate fetches
  const lastSelectedChatIdRef = useRef<string>("");
  
  const updateSelectedActiveChat = async (selectedChat: ActiveChat) => {
    // Find the channel metadata to get channelType
    const channelMeta = channels.find((ch: ChannelMeta) => ch.name === selectedChat.name);
    if (channelMeta && selectedChat.type === "channel") {
      selectedChat.channelType = channelMeta.channelType;
    }
    
    // Clear message state using hooks
    mainMessages.clear();
    threadMessages.clear();
    setOpenThread(undefined);
    setCurrentOpenThread(undefined);
    
    // Then update the active chat
    setIsOpenSearchChannel(false);
    setActiveChat(selectedChat);
    activeChatRef.current = selectedChat;
    setIsSidebarOpen(false);
    updateSessionChat(selectedChat);
    
    // Only fetch channel users/non-invited if this is a new chat
    // Prevents excessive API calls when re-selecting the same chat
    const chatId = selectedChat.id || selectedChat.name;
    if (lastSelectedChatIdRef.current !== chatId) {
      lastSelectedChatIdRef.current = chatId;
      
      // Only fetch for channels, not for DMs
      if (selectedChat.type === "channel") {
        getChannelUsers(selectedChat.id);
        getNonInvitedUsers(selectedChat.id);
      }
    }
    
    // Subscribe to websocket events for this chat
    if (app && subscriptionRef.current) {
      const useDM = (selectedChat.type === "direct_message" &&
        selectedChat.account &&
        !selectedChat.canJoin &&
        selectedChat.otherIdentityNew) as boolean;
      const contextId = getContextId();
      const dmContextId = getDmContextId();
      const currentContextId = (useDM ? dmContextId : contextId) || "";
      if (currentContextId) {
        subscriptionRef.current.subscribe(currentContextId);
      }
    }
  };

  const openSearchPage = useCallback(() => {
    setIsOpenSearchChannel(true);
    setIsSidebarOpen(false);
    setActiveChat(null);
  }, []);

  useLayoutEffect(() => {
    const storedSession: ActiveChat | null = getStoredSession();
    const chatToUse = storedSession || defaultActiveChat;

    setActiveChat(chatToUse);
    activeChatRef.current = chatToUse;
    
    // Only fetch channel members for actual channels, not DMs
    if (chatToUse.type === "channel") {
      getChannelUsers(chatToUse.name);
      getNonInvitedUsers(chatToUse.name);
    }
    
    mainMessages.clear();
    threadMessages.clear();

    // Delay to ensure app is ready before subscribing
    setTimeout(() => {
      updateSelectedActiveChat(chatToUse);
    }, SUBSCRIPTION_INIT_DELAY_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track last DM selection to prevent rapid re-selections
  const lastDMSelectionRef = useRef<{ contextId: string; timestamp: number } | null>(null);
  
  const onDMSelected = useCallback(
    async (dm?: DMChatInfo, sc?: ActiveChat, refetch?: boolean) => {
      const contextId = sc?.contextId || dm?.context_id || "";
      
      // Prevent rapid re-selection of the same DM (within 1 second)
      const now = Date.now();
      if (
        lastDMSelectionRef.current &&
        lastDMSelectionRef.current.contextId === contextId &&
        now - lastDMSelectionRef.current.timestamp < 1000
      ) {
        console.log("onDMSelected: Skipping rapid re-selection of same DM");
        return;
      }
      
      lastDMSelectionRef.current = { contextId, timestamp: now };
      
      let canJoin = true;
      const verifyContextResponse = await apiClient
        .node()
        .getContext(contextId);
      if (verifyContextResponse.data) {
        canJoin = !(verifyContextResponse.data.rootHash ? true : false);
      }

      const isSynced =
        verifyContextResponse.data?.rootHash !==
        "11111111111111111111111111111111";

      if ((sc?.account || dm?.own_identity) && !canJoin && isSynced) {
        await new ClientApiDataSource().joinChat({
          contextId: dm?.context_id || "",
          isDM: true,
          executor: dm?.own_identity || "",
          username: dm?.own_username || "",
        });
      }

      let selectedChat = {} as ActiveChat;
      if (sc?.contextId) {
        selectedChat = {
          ...sc,
          canJoin: canJoin,
          isSynced: isSynced,
        };
      } else {
        selectedChat = {
          type: "direct_message" as ChatType,
          contextId: dm?.context_id || "",
          readOnly: false,
          canJoin: canJoin,
          invitationPayload: dm?.invitation_payload || "",
          id: dm?.other_identity_old || "",
          name: dm?.other_identity_old || "",
          username: dm?.other_username || "",
          account: dm?.own_identity || "",
          otherIdentityNew: dm?.other_identity_new || "",
          creator: dm?.created_by || "",
          isSynced: isSynced,
        };
      }

      // Set DM context BEFORE calling updateSelectedActiveChat
      // This is critical for DMs to work properly
      setDmContextId(sc?.contextId || dm?.context_id || "");
      mainMessages.clear();
      threadMessages.clear();
      
      // Let updateSelectedActiveChat handle all the state updates and message loading
      // Don't duplicate state setting here - it causes issues
      await updateSelectedActiveChat(selectedChat);

      if (refetch) {
        try {
          await new ClientApiDataSource().readDm({
            other_user_id: dm?.other_identity_old || "",
          });
          // Refresh DM list to update unread counts
          await dmsHook.fetchDms();
        } catch (error) {
          console.error("Error in onDMSelected:", error);
        }
      }
    },
    [updateSelectedActiveChat, mainMessages, threadMessages, dmsHook]
  );

  // Use debounced fetch methods from custom hooks
  const debouncedFetchChannels = channelsHook.debouncedFetchChannels;
  const debouncedFetchDms = dmsHook.debouncedFetchDms;

  const loadInitialChatMessages = useCallback(async (): Promise<ChatMessagesData> => {
    const result = await mainMessages.loadInitial(activeChat);

    if (activeChat?.type === "channel" && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      if (lastMessage?.timestamp) {
        await new ClientApiDataSource().readMessage({
          channel: { name: activeChat.name },
          timestamp: lastMessage.timestamp,
        });
      }
    }

    return result;
  }, [activeChat, mainMessages]);

  // Use custom hooks instead of local state + fetch functions
  const channels = channelsHook.channels;
  const fetchChannels = channelsHook.fetchChannels;
  
  const privateDMs = dmsHook.dms;
  const fetchDms = dmsHook.fetchDms;
  
  const chatMembers = chatMembersHook.members;
  const fetchChatMembers = chatMembersHook.fetchMembers;

  // Use chat handlers hook to manage all event-related logic
  const {
    handleMessageUpdates,
    handleDMUpdates,
    handleStateMutation,
    handleExecutionEvent,
  } = useChatHandlers(
    activeChatRef,
    activeChat,
    mainMessages,
    playSoundForMessage,
    fetchDms,
    onDMSelected,
    debouncedFetchChannels,
    debouncedFetchDms,
    debouncedReFetchChannelMembers
  );

  // Create event callback for websocket subscription
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventCallbackFn = useCallback(async (event: any) => {
    // Prevent infinite loops
    if (isProcessingEvent.current) {
      return;
    }

    // Rate limiting - prevent events from firing too frequently
    const now = Date.now();
    if (now - lastEventTime.current < EVENT_RATE_LIMIT_MS) {
      return;
    }
    lastEventTime.current = now;

    // Prevent duplicate events
    const eventId = `${event.type}-${event.data?.timestamp || now}`;
    if (eventQueue.current.has(eventId)) {
      return;
    }
    eventQueue.current.add(eventId);

    // Clean up old events from queue
    if (eventQueue.current.size > EVENT_QUEUE_MAX_SIZE) {
      const eventsArray = Array.from(eventQueue.current);
      eventQueue.current = new Set(eventsArray.slice(-EVENT_QUEUE_CLEANUP_SIZE));
    }

    const sessionChat = getStoredSession();
    const useDM = (sessionChat?.type === "direct_message" &&
      sessionChat?.account &&
      !sessionChat?.canJoin &&
      sessionChat?.otherIdentityNew) as boolean;

    const contextId = getContextId();
    const dmContextId = getDmContextId();
    const currentContextId = (useDM ? dmContextId : contextId) || "";

    if (!currentContextId) {
      eventQueue.current.delete(eventId);
      return;
    }

    isProcessingEvent.current = true;

    try {
      switch (event.type) {
        case "StateMutation":
          await handleStateMutation(event);
          break;
        case "ExecutionEvent":
          await handleExecutionEvent(event);
          break;
        default:
      }
    } catch (callbackError) {
      console.error("Error in subscription callback:", callbackError);
    } finally {
      isProcessingEvent.current = false;
      eventQueue.current.delete(eventId);
    }
  }, [handleStateMutation, handleExecutionEvent]);

  // Use WebSocket subscription hook (pass callback directly, hook handles refs internally)
  const subscription = useWebSocketSubscription(app, eventCallbackFn);
  
  // Store subscription in ref for updateSelectedActiveChat
  subscriptionRef.current = subscription;

  // Track if initial fetch has been done - using useState to ensure it persists
  const initialFetchDone = useRef(false);
  const isFetchingInitial = useRef(false);

  useEffect(() => {
    // Only fetch once on mount to avoid 429 errors from rapid refetches
    // Use both flags to prevent concurrent fetches
    if (!initialFetchDone.current && !isFetchingInitial.current) {
      isFetchingInitial.current = true;
      
      // Batch initial data fetches for faster load using custom hooks
      Promise.all([
        channelsHook.fetchChannels(),
        dmsHook.fetchDms(),
        chatMembersHook.fetchMembers(),
      ]).then(() => {
        initialFetchDone.current = true;
        isFetchingInitial.current = false;
      }).catch(error => {
        console.error("Error fetching initial data:", error);
        isFetchingInitial.current = false;
      });
    }

    // Cleanup is handled by useWebSocketSubscription hook
  }, [channelsHook, dmsHook, chatMembersHook]);

  const onJoinedChat = async () => {
    let canJoin = false;
    if (activeChatRef.current?.type === "direct_message") {
      const joinContextResponse = await apiClient
        .node()
        .joinContext(activeChatRef.current?.invitationPayload || "");
      if (joinContextResponse.data) {
        await fetchDms();
        if (app) {
          const useDM = (activeChatRef.current?.type === "direct_message" &&
            activeChatRef.current?.account &&
            !activeChatRef.current?.canJoin &&
            activeChatRef.current?.otherIdentityNew) as boolean;
          const contextId = getContextId();
          const dmContextId = getDmContextId();
          const currentContextId = (useDM ? dmContextId : contextId) || "";
          if (currentContextId) {
            subscription.subscribe(currentContextId);
          }
        }
      } else {
        canJoin = true;
      }
    } else {
      await fetchChannels();
    }
    const activeChatCopy = { ...activeChat };
    if (activeChatCopy && activeChat) {
      activeChatCopy.canJoin = canJoin;
      activeChatCopy.type = activeChat.type;
      activeChatCopy.id = activeChat.id;
      activeChatCopy.name = activeChat.name;
      activeChatCopy.readOnly = activeChat.readOnly;
      activeChatCopy.account = activeChat.account;
    }
    setActiveChat(activeChatCopy as ActiveChat);
    activeChatRef.current = activeChatCopy as ActiveChat;
  };

  const loadPrevMessages = useCallback(
    async (chatId: string): Promise<ChatMessagesDataWithOlder> => {
      return await mainMessages.loadPrevious(activeChat, chatId);
    },
    [activeChat, mainMessages]
  );

  const createDM = async (value: string): Promise<CreateContextResult> => {
    // @ts-expect-error - chatMembers is a Map<string, string>
    const creatorUsername = chatMembers[getExecutorPublicKey() || ""];
    // @ts-expect-error - chatMembers is a Map<string, string>
    const inviteeUsername = chatMembers[value];
    const dmParams = generateDMParams(value, creatorUsername, inviteeUsername);
    const response = await apiClient
      .node()
      .createContext(
        dmParams.applicationId,
        dmParams.params,
        dmParams.protocol
      );

    const verifyContextResponse = await apiClient
      .node()
      .getContext(response?.data?.contextId || "");
    const hash =
      verifyContextResponse.data?.rootHash ??
      "11111111111111111111111111111111";

    if (response.data) {
      const createDMResponse = await new ClientApiDataSource().createDm({
        context_id: response.data.contextId,
        creator: getExecutorPublicKey() || "",
        creator_new_identity: response.data.memberPublicKey,
        context_hash: hash as string,
        invitee: value,
        timestamp: Date.now(),
      });
      if (createDMResponse.data) {
        await fetchDms();
        return {
          data: "DM created successfully",
          error: "",
        };
      } else {
        await apiClient.node().deleteContext(response.data.contextId);
        return {
          data: "",
          error: "Failed to create DM - DM already exists",
        };
      }
    } else {
      return {
        data: "",
        error: "Failed to create DM",
      };
    }
  };

  const loadInitialThreadMessages = useCallback(
    async (parentMessageId: string): Promise<ChatMessagesData> => {
      return await threadMessages.loadInitial(activeChat, parentMessageId);
    },
    [activeChat, threadMessages]
  );

  const updateCurrentOpenThread = useCallback(
    (thread: CurbMessage | undefined) => {
      setCurrentOpenThread(thread);
    },
    []
  );

  const loadPrevThreadMessages = useCallback(
    async (parentMessageId: string): Promise<ChatMessagesDataWithOlder> => {
      return await threadMessages.loadPrevious(activeChat, parentMessageId);
    },
    [activeChat, threadMessages]
  );

  return (
    <AppContainer
      isOpenSearchChannel={isOpenSearchChannel}
      setIsOpenSearchChannel={setIsOpenSearchChannel}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      activeChat={activeChat}
      updateSelectedActiveChat={updateSelectedActiveChat}
      reFetchChannelMembers={reFetchChannelMembers}
      openSearchPage={openSearchPage}
      channelUsers={channelMembersHook.channelUsers}
      nonInvitedUserList={channelMembersHook.nonInvitedUsers}
      onDMSelected={onDMSelected}
      loadInitialChatMessages={loadInitialChatMessages}
      incomingMessages={mainMessages.incomingMessages}
      channels={channels}
      fetchChannels={fetchChannels}
      onJoinedChat={onJoinedChat}
      loadPrevMessages={loadPrevMessages}
      chatMembers={chatMembers}
      createDM={createDM}
      privateDMs={privateDMs}
      loadInitialThreadMessages={loadInitialThreadMessages}
      incomingThreadMessages={threadMessages.messages}
      loadPrevThreadMessages={loadPrevThreadMessages}
      updateCurrentOpenThread={updateCurrentOpenThread}
      openThread={openThread}
      setOpenThread={setOpenThread}
      currentOpenThreadRef={currentOpenThreadRef}
      addOptimisticMessage={addOptimisticMessage}
    />
  );
}
