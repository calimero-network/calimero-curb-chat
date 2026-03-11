import { useCallback, useEffect, useState, useRef } from "react";
import AppContainer from "../../components/common/AppContainer";
import {
  type ActiveChat,
  type GroupContextChannel,
  type ChatMessagesData,
  type ChatMessagesDataWithOlder,
  type ChatType,
  type CurbMessage,
} from "../../types/Common";
import {
  addDmContextId,
  getDmContextId,
  getStoredSession,
  setDmContextId,
  updateSessionChat,
} from "../../utils/session";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
import {
  type ResponseData,
  apiClient,
  getExecutorPublicKey,
  setContextId,
  setExecutorPublicKey,
  useCalimero,
} from "@calimero-network/calimero-client";
import type { DMChatInfo } from "../../api/clientApi";
import type { CreateContextResult } from "../../components/popups/StartDMPopup";
import { generateDMParams } from "../../utils/dmSetupState";
import { useAppNotifications } from "../../hooks/useAppNotifications";
import { SUBSCRIPTION_INIT_DELAY_MS } from "../../constants/app";
import { log } from "../../utils/logger";
import type { WebSocketEvent } from "../../types/WebSocketTypes";
import { useGroupContexts } from "../../hooks/useGroupContexts";
import { useDMs } from "../../hooks/useDMs";
import { useChatMembers } from "../../hooks/useChatMembers";
import { useChannelMembers } from "../../hooks/useChannelMembers";
import { useMessages } from "../../hooks/useMessages";
import { useThreadMessages } from "../../hooks/useThreadMessages";
import { useWebSocket, useWebSocketEvents } from "../../contexts/WebSocketContext";
import { useChatHandlers } from "../../hooks/useChatHandlers";
import { getGroupId } from "../../constants/config";
import type { ContextInviteByOpenInvitationResponse } from "@calimero-network/calimero-client/lib/api/nodeApi";

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
    undefined,
  );

  const webSocket = useWebSocket();

  const mainMessages = useMessages();
  const threadMessages = useThreadMessages();
  const {
    searchResults,
    searchTotalCount,
    searchQuery,
    isSearching: isSearchingMessages,
    searchOffset,
    searchMessages: executeSearchMessages,
    clearSearch: clearMessageSearch,
    searchError,
  } = mainMessages;
  const searchHasMore = searchOffset < searchTotalCount;

  const {
    notifyMessage,
    notifyDM,
    notifyChannel,
    playSoundForMessage,
    playSound,
  } = useAppNotifications(activeChat?.id);

  // Group-based channel list (replaces old useChannels)
  const groupContextsHook = useGroupContexts();
  const dmsHook = useDMs();
  const chatMembersHook = useChatMembers();
  const channelMembersHook = useChannelMembers();

  const messagesRef = mainMessages.messagesRef;
  const incomingMessages = mainMessages.incomingMessages;
  const addOptimisticMessage = mainMessages.addOptimistic;
  const addOptimisticThreadMessage = threadMessages.addOptimistic;

  useEffect(() => {
    const handleFirstInteraction = () => {
      playSound("message");
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
    };

    document.addEventListener("click", handleFirstInteraction);
    document.addEventListener("keydown", handleFirstInteraction);

    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
    };
  }, [playSound]);

  useEffect(() => {
    if (!isConfigSet) {
      window.location.href = "/login";
    }
  }, [isConfigSet]);

  useEffect(() => {
    currentOpenThreadRef.current = currentOpenThread;
  }, [currentOpenThread]);

  const getChannelUsersRef = useRef(channelMembersHook.fetchChannelMembers);
  const getNonInvitedUsersRef = useRef(channelMembersHook.fetchNonInvitedUsers);

  getChannelUsersRef.current = channelMembersHook.fetchChannelMembers;
  getNonInvitedUsersRef.current = channelMembersHook.fetchNonInvitedUsers;

  const getChannelUsers = useCallback(async (id: string) => {
    return getChannelUsersRef.current(id);
  }, []);

  const getNonInvitedUsers = useCallback(async (id: string) => {
    return getNonInvitedUsersRef.current(id);
  }, []);

  const reFetchChannelMembers = useCallback(async () => {
    const isDM = activeChatRef.current?.type === "direct_message";
    await getChannelUsersRef.current(
      (isDM ? "private_dm" : activeChatRef.current?.id) || "",
    );
  }, []);

  const lastSelectedChatIdRef = useRef<string>("");

  /**
   * Switch the active chat. For channels (group contexts), this also switches
   * the calimero-client contextId and executorPublicKey so that subsequent
   * RPC calls (messages, reactions, etc.) target the correct context.
   */
  const updateSelectedActiveChat = async (selectedChat: ActiveChat) => {
    mainMessages.clear();
    threadMessages.clear();
    setOpenThread(undefined);
    setCurrentOpenThread(undefined);

    // For group-based channels, switch context identity
    if (selectedChat.type === "channel" && selectedChat.contextId) {
      const identity =
        selectedChat.contextIdentity ||
        groupContextsHook.getIdentity(selectedChat.contextId);

      if (identity) {
        setContextId(selectedChat.contextId);
        setExecutorPublicKey(identity);
        log.info(
          "Home",
          `Switched context to ${selectedChat.contextId.substring(0, 8)}... with identity ${identity.substring(0, 8)}...`,
        );
      } else {
        log.warn(
          "Home",
          `No identity found for context ${selectedChat.contextId} — RPC calls may fail`,
        );
        setContextId(selectedChat.contextId);
      }
    }

    setIsOpenSearchChannel(false);
    setActiveChat(selectedChat);
    activeChatRef.current = selectedChat;
    setIsSidebarOpen(false);
    updateSessionChat(selectedChat);

    const chatId = selectedChat.id || selectedChat.name;
    if (lastSelectedChatIdRef.current !== chatId) {
      lastSelectedChatIdRef.current = chatId;

      if (selectedChat.type === "channel") {
        getChannelUsers(selectedChat.id);
        getNonInvitedUsers(selectedChat.id);
      }
    }

    log.debug("Home", `Active chat changed to: ${selectedChat.name} (context: ${selectedChat.contextId || "n/a"})`);
  };

  const openSearchPage = useCallback(() => {
    setIsOpenSearchChannel(true);
    setIsSidebarOpen(false);
    setActiveChat(null);
  }, []);

  const handleSearchMessages = useCallback(
    async (query: string) => {
      await executeSearchMessages(activeChatRef.current, query, { reset: true });
    },
    [executeSearchMessages],
  );

  const handleLoadMoreSearch = useCallback(async () => {
    if (!searchQuery) return;
    await executeSearchMessages(activeChatRef.current, searchQuery, {
      offset: searchOffset,
    });
  }, [executeSearchMessages, searchOffset, searchQuery]);

  const handleClearSearch = useCallback(() => {
    clearMessageSearch();
  }, [clearMessageSearch]);

  useEffect(() => {
    const storedSession: ActiveChat | null = getStoredSession();
    if (!storedSession) return;

    setActiveChat(storedSession);
    activeChatRef.current = storedSession;

    if (storedSession.type === "channel") {
      getChannelUsers(storedSession.name);
      getNonInvitedUsers(storedSession.name);
    }

    mainMessages.clear();
    threadMessages.clear();

    setTimeout(() => {
      updateSelectedActiveChat(storedSession);
    }, SUBSCRIPTION_INIT_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastDMSelectionRef = useRef<{
    contextId: string;
    timestamp: number;
  } | null>(null);

  const channelsDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const dmsDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const membersDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const fetchGroupChannels = useCallback(() => {
    const gid = getGroupId();
    if (gid) groupContextsHook.fetchGroupContexts(gid);
  }, [groupContextsHook]);

  const fetchChannelsRef = useRef(fetchGroupChannels);
  const fetchDmsRef = useRef(dmsHook.fetchDms);
  const fetchMembersRef = useRef(chatMembersHook.fetchMembers);

  fetchChannelsRef.current = fetchGroupChannels;
  fetchDmsRef.current = dmsHook.fetchDms;
  fetchMembersRef.current = chatMembersHook.fetchMembers;

  const debouncedFetchChannels = useCallback(async () => {
    clearTimeout(channelsDebounceRef.current);
    channelsDebounceRef.current = setTimeout(
      () => fetchChannelsRef.current(),
      3000,
    );
  }, []);

  const debouncedFetchDMs = useCallback(async () => {
    clearTimeout(dmsDebounceRef.current);
    dmsDebounceRef.current = setTimeout(() => fetchDmsRef.current(), 3000);
  }, []);

  const debouncedFetchMembers = useCallback(async () => {
    clearTimeout(membersDebounceRef.current);
    membersDebounceRef.current = setTimeout(
      () => fetchMembersRef.current(),
      3000,
    );
  }, []);

  const mainMessagesRef = useRef(mainMessages);
  const threadMessagesRef = useRef(threadMessages);
  const playSoundForMessageRef = useRef(playSoundForMessage);
  const notifyMessageRef = useRef(notifyMessage);
  const notifyDMRef = useRef(notifyDM);
  const notifyChannelRef = useRef(notifyChannel);
  const onDMSelectedRef = useRef<
    (dm?: DMChatInfo, sc?: ActiveChat, refetch?: boolean) => void
  >(() => {});

  mainMessagesRef.current = mainMessages;
  threadMessagesRef.current = threadMessages;
  playSoundForMessageRef.current = playSoundForMessage;
  notifyMessageRef.current = notifyMessage;
  notifyDMRef.current = notifyDM;
  notifyChannelRef.current = notifyChannel;

  const chatHandlersRefs = useRef({
    mainMessages: mainMessagesRef,
    threadMessages: threadMessagesRef,
    playSoundForMessage: playSoundForMessageRef,
    notifyMessage: notifyMessageRef,
    notifyDM: notifyDMRef,
    notifyChannel: notifyChannelRef,
    fetchDms: fetchDmsRef,
    onDMSelected: onDMSelectedRef,
    fetchChannels: { current: debouncedFetchChannels },
    fetchDMs: { current: debouncedFetchDMs },
    fetchMembers: { current: debouncedFetchMembers },
  }).current;

  const updateSelectedActiveChatRef = useRef(updateSelectedActiveChat);
  updateSelectedActiveChatRef.current = updateSelectedActiveChat;

  const onDMSelected = useCallback(
    async (dm?: DMChatInfo, sc?: ActiveChat, refetch?: boolean) => {
      const contextId = sc?.contextId || dm?.context_id || "";

      const now = Date.now();
      if (
        lastDMSelectionRef.current &&
        lastDMSelectionRef.current.contextId === contextId &&
        now - lastDMSelectionRef.current.timestamp < 1000
      ) {
        log.debug("onDMSelected", "Skipping rapid re-selection of same DM");
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
      const isSynced = verifyContextResponse.data ? 
        verifyContextResponse.data?.rootHash !==
        "11111111111111111111111111111111" : false;

      if ((sc?.account || dm?.own_identity) && isSynced) {
        const executor = sc?.ownIdentity || sc?.account || dm?.own_identity || "";
        const username = sc?.ownUsername || sc?.username || dm?.own_username || "";
        if (executor && username) {
          await new ClientApiDataSource().joinChat({
            contextId: dm?.context_id || "",
            isDM: true,
            executor: executor,
            username: username,
          });
        } else {
          console.warn("Missing executor or username for DM join:", { executor, username });
        }
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
          ownIdentity: dm?.own_identity || "",
          ownUsername: dm?.own_username || "",
        };
      }

      const dmCtxId = sc?.contextId || dm?.context_id || "";
      setDmContextId(dmCtxId);
      if (dmCtxId) addDmContextId(dmCtxId);
      mainMessagesRef.current.clear();
      threadMessagesRef.current.clear();

      await updateSelectedActiveChatRef.current(selectedChat);

      if (refetch) {
        try {
          await new ClientApiDataSource().readDm({
            other_user_id: dm?.other_identity_old || "",
          });
          await fetchDmsRef.current();
        } catch (error) {
          log.error("onDMSelected", "Error in DM selection", error);
        }
      }
    },
    [],
  );

  onDMSelectedRef.current = onDMSelected;

  const loadInitialChatMessages =
    useCallback(async (): Promise<ChatMessagesData> => {
      const result = await mainMessagesRef.current.loadInitial(
        activeChatRef.current,
      );

      if (
        activeChatRef.current?.type === "channel" &&
        result.messages.length > 0
      ) {
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage?.timestamp) {
          await new ClientApiDataSource().readMessage({
            channel: { name: activeChatRef.current.name },
            timestamp: lastMessage.timestamp,
          });
        }
      }

      return result;
    }, []);

  // Group-based channels (each context = one channel)
  const channels: GroupContextChannel[] = groupContextsHook.channels.filter(
    (ch) => !ch.info || ch.info.type === "channel",
  );

  const privateDMs = dmsHook.dms;
  const fetchDms = dmsHook.fetchDms;

  const chatMembers = chatMembersHook.members;
  const fetchChatMembers = chatMembersHook.fetchMembers;

  const {
    handleMessageUpdates,
    handleThreadMessageUpdates,
    handleDMUpdates,
    handleStateMutation,
    handleExecutionEvents,
  } = useChatHandlers(activeChatRef, activeChat, chatHandlersRefs);

  useWebSocketEvents(useCallback(async (event: WebSocketEvent) => {
    try {
      await handleStateMutation(event);

      if (openThread) {
        const sessionChat = getStoredSession();
        const useDM = (sessionChat?.type === "direct_message" &&
          sessionChat?.account &&
          !sessionChat?.canJoin &&
          sessionChat?.otherIdentityNew) as boolean;

        await handleThreadMessageUpdates(useDM, openThread.id);
      }
    } catch (error) {
      log.error("Home", "Error processing WebSocket event", error);
    }
  }, [handleStateMutation, handleThreadMessageUpdates, openThread]));

  const initialFetchDone = useRef(false);
  const isFetchingInitial = useRef(false);

  useEffect(() => {
    if (!initialFetchDone.current && !isFetchingInitial.current) {
      isFetchingInitial.current = true;

      const groupId = getGroupId();
      const fetchPromises: Promise<unknown>[] = [
        dmsHook.fetchDms(),
        chatMembersHook.fetchMembers(),
      ];

      if (groupId) {
        fetchPromises.push(groupContextsHook.fetchGroupContexts(groupId));
      }

      Promise.all(fetchPromises)
        .then(() => {
          initialFetchDone.current = true;
          isFetchingInitial.current = false;
        })
        .catch((error) => {
          log.error("Home", "Error fetching initial data", error);
          isFetchingInitial.current = false;
        });
    }
  }, [dmsHook, chatMembersHook, groupContextsHook]);

  // Subscribe to ALL group contexts + DM contexts for real-time updates
  useEffect(() => {
    if (!app) return;

    const contextIdsToSubscribe: string[] = [];

    // Add all group context IDs (each channel is its own context now)
    if (groupContextsHook.contextIds.length > 0) {
      groupContextsHook.contextIds.forEach((id) => {
        if (id && !contextIdsToSubscribe.includes(id)) {
          contextIdsToSubscribe.push(id);
        }
      });
      log.debug("Home", `Adding ${groupContextsHook.contextIds.length} group contexts for subscription`);
    }

    // Add DM contexts
    if (privateDMs && privateDMs.length > 0) {
      privateDMs.forEach((dm) => {
        if (dm.context_id && !contextIdsToSubscribe.includes(dm.context_id)) {
          contextIdsToSubscribe.push(dm.context_id);
        }
      });
      log.debug("Home", `Added ${privateDMs.length} DM contexts`);
    }

    if (contextIdsToSubscribe.length > 0) {
      log.info(
        "Home",
        `Subscribing to ${contextIdsToSubscribe.length} contexts (${groupContextsHook.contextIds.length} channels + ${privateDMs.length} DMs)`,
        { totalContexts: contextIdsToSubscribe.length },
      );
      webSocket.subscribeToContexts(contextIdsToSubscribe);
    } else {
      log.warn("Home", "No contexts to subscribe to");
    }
  }, [app, groupContextsHook.contextIds, privateDMs, webSocket]);

  const onJoinedChat = async () => {
    let canJoin = false;
    if (activeChatRef.current?.type === "direct_message") {
      const joinContextResponse = await apiClient
        .node()
        .joinContext(activeChatRef.current?.invitationPayload || "");
      if (joinContextResponse.data) {
        await fetchDms();
        log.info("Home", "Joined chat successfully, multi-context subscription will update");
      } else {
        canJoin = true;
      }
    } else {
      fetchGroupChannels();
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
      return await mainMessagesRef.current.loadPrevious(
        activeChatRef.current,
        chatId,
      );
    },
    [],
  );

  const createDM = async (value: string): Promise<CreateContextResult> => {
    // @ts-expect-error - chatMembers is a Map<string, string>
    const creatorUsername = chatMembers[getExecutorPublicKey() || ""];
    // @ts-expect-error - chatMembers is a Map<string, string>
    const inviteeUsername = chatMembers[value];
    const dmParams = generateDMParams(value, creatorUsername, inviteeUsername);
    try {
      const response = await apiClient
      .node()
      .createContext(
        dmParams.applicationId,
        dmParams.params,
        dmParams.protocol,
      );
      console.log("response", response)

    const verifyContextResponse = await apiClient
      .node()
      .getContext(response?.data?.contextId || "");
    const hash =
      verifyContextResponse.data?.rootHash ??
      "11111111111111111111111111111111";

    if (response.data) {
      const invitationPayloadResponse: ResponseData<ContextInviteByOpenInvitationResponse> =
        await apiClient
          .node()
          .contextInviteByOpenInvitation(
            response.data.contextId,
            response.data.memberPublicKey as string,
            86400
          );
      if (invitationPayloadResponse.error) {
        await apiClient.node().deleteContext(response.data.contextId);
        return {
          data: "",
          error: "Failed to create DM - failed to generate invitation payload",
        };
      }
      const createDMResponse = await new ClientApiDataSource().createDm({
        context_id: response.data.contextId,
        creator: getExecutorPublicKey() || "",
        creator_new_identity: response.data.memberPublicKey,
        context_hash: hash as string,
        invitee: value,
        timestamp: Date.now(),
        payload: JSON.stringify(invitationPayloadResponse.data),
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
    } catch (error) {
      console.error("createDM failed:", error);
      return {
        data: "",
        error: "Failed to create DM",
      };
    }
  };

  const loadInitialThreadMessages = useCallback(
    async (parentMessageId: string): Promise<ChatMessagesData> => {
      log.debug(
        "Home",
        `loadInitialThreadMessages called for parent: ${parentMessageId}`,
      );
      const result = await threadMessagesRef.current.loadInitial(
        activeChatRef.current,
        parentMessageId,
      );
      log.debug("Home", `loadInitialThreadMessages result:`, result);
      return result;
    },
    [],
  );

  const updateCurrentOpenThread = useCallback(
    (thread: CurbMessage | undefined) => {
      setCurrentOpenThread(thread);
    },
    [],
  );

  const loadPrevThreadMessages = useCallback(
    async (parentMessageId: string): Promise<ChatMessagesDataWithOlder> => {
      return await threadMessagesRef.current.loadPrevious(
        activeChatRef.current,
        parentMessageId,
      );
    },
    [],
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
      fetchChannels={fetchGroupChannels}
      onChannelCreated={fetchGroupChannels}
      onJoinedChat={onJoinedChat}
      loadPrevMessages={loadPrevMessages}
      chatMembers={chatMembers}
      createDM={createDM}
      privateDMs={privateDMs}
      loadInitialThreadMessages={loadInitialThreadMessages}
      incomingThreadMessages={threadMessages.incomingMessages}
      clearThreadsMessagesOnSwitch={threadMessages.clear}
      loadPrevThreadMessages={loadPrevThreadMessages}
      updateCurrentOpenThread={updateCurrentOpenThread}
      openThread={openThread}
      setOpenThread={setOpenThread}
      currentOpenThreadRef={currentOpenThreadRef}
      addOptimisticMessage={addOptimisticMessage}
      addOptimisticThreadMessage={addOptimisticThreadMessage}
      wsIsSubscribed={webSocket.isSubscribed()}
      wsContextId={webSocket.getSubscribedContexts().join(", ") || null}
      wsSubscriptionCount={webSocket.getSubscriptionCount()}
      searchResults={searchResults}
      searchTotalCount={searchTotalCount}
      searchQuery={searchQuery}
      isSearchingMessages={isSearchingMessages}
      searchHasMore={searchHasMore}
      searchError={searchError}
      onSearchMessages={handleSearchMessages}
      onLoadMoreSearch={handleLoadMoreSearch}
      onClearSearch={handleClearSearch}
    />
  );
}
