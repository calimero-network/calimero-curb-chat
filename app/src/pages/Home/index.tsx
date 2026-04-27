import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppContainer from "../../components/common/AppContainer";
import {
  type ActiveChat,
  type GroupContextChannel,
  type ChatMessagesData,
  type ChatMessagesDataWithOlder,
  type CurbMessage,
} from "../../types/Common";
import {
  getStoredSession,
  updateSessionChat,
} from "../../utils/session";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
import { ContextApiDataSource } from "../../api/dataSource/nodeApiDataSource";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import {
  setContextId,
  setExecutorPublicKey,
  useCalimero,
} from "@calimero-network/calimero-client";
import type { CreateContextResult } from "../../components/popups/StartDMPopup";
import type { DMContextInfo } from "../../hooks/useDMs";
import { useAppNotifications } from "../../hooks/useAppNotifications";
import { SUBSCRIPTION_INIT_DELAY_MS } from "../../constants/app";
import { log } from "../../utils/logger";
import type { WebSocketEvent } from "../../types/WebSocketTypes";
import { useGroupContexts } from "../../hooks/useGroupContexts";
import { useDMs } from "../../hooks/useDMs";
import { useChatMembers } from "../../hooks/useChatMembers";
import { useChannelMembers } from "../../hooks/useChannelMembers";
import { useGroupMembers } from "../../hooks/useGroupMembers";
import { useMessages } from "../../hooks/useMessages";
import { useThreadMessages } from "../../hooks/useThreadMessages";
import { useWebSocket, useWebSocketEvents } from "../../contexts/WebSocketContext";
import { useChatHandlers } from "../../hooks/useChatHandlers";
import {
  getApplicationId,
  getGroupId,
  getGroupMemberIdentity,
  setGroupMemberIdentity,
} from "../../constants/config";
import { getAppEntryState } from "../../utils/appEntry";
import { getContextProfileSyncAction } from "../../utils/contextProfileSync";
import { getMessengerDisplayName, getIdentityDisplayName, getStoredExecutorIdentity } from "../../utils/messengerName";
import {
  createDmContextInGroup,
  getDmDisplayName,
} from "../../utils/dmContext";
import { useCurrentGroupPermissions } from "../../hooks/useCurrentGroupPermissions";
import { buildDmMemberOptions } from "../../utils/dmMemberOptions";

export default function Home({ isConfigSet }: { isConfigSet: boolean }) {
  const { app } = useCalimero();
  const currentGroupId = getGroupId();
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
  const groupMembersHook = useGroupMembers();
  const currentGroupPermissions = useCurrentGroupPermissions(currentGroupId);

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

  const entryState = getAppEntryState({
    isAuthenticated: true,
    isConfigSet,
    groupId: currentGroupId,
    messengerName: getIdentityDisplayName(getStoredExecutorIdentity()) || getMessengerDisplayName(),
    activeChat,
  });

  useEffect(() => {
    if (entryState === "browse-channels") {
      setIsOpenSearchChannel(true);
      return;
    }

    if (entryState === "chat") {
      setIsOpenSearchChannel(false);
    }
  }, [entryState]);

  const getChannelUsersRef = useRef(channelMembersHook.fetchChannelMembers);
  getChannelUsersRef.current = channelMembersHook.fetchChannelMembers;

  const getChannelUsers = useCallback(async (id: string) => {
    return getChannelUsersRef.current(id);
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

    // For group-based channels and DMs, switch context identity
    let resolvedChat = selectedChat;

    if (
      (selectedChat.type === "channel" || selectedChat.type === "direct_message") &&
      selectedChat.contextId
    ) {
      const identity =
        selectedChat.contextIdentity ||
        groupContextsHook.getIdentity(selectedChat.contextId);

      if (identity) {
        resolvedChat = {
          ...selectedChat,
          contextIdentity: identity,
          canJoin: false,
          requiresProfileSetup: false,
        };
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

    // Commit the chat switch immediately — no blocking awaits
    setActiveChat(resolvedChat);
    activeChatRef.current = resolvedChat;
    setIsSidebarOpen(false);
    updateSessionChat(resolvedChat);

    const chatId = resolvedChat.id || resolvedChat.name;
    if (lastSelectedChatIdRef.current !== chatId) {
      lastSelectedChatIdRef.current = chatId;

      if (resolvedChat.type === "channel") {
        getChannelUsers(resolvedChat.id);
      }
    }

    // Background: ensure WASM profile is written for this context (no-op if already set via enterChat)
    if (
      (resolvedChat.type === "channel" || resolvedChat.type === "direct_message") &&
      resolvedChat.contextId &&
      resolvedChat.contextIdentity
    ) {
      const messengerName =
        getIdentityDisplayName(resolvedChat.contextIdentity || "") ||
        getMessengerDisplayName();
      if (messengerName) {
        const ctxId = resolvedChat.contextId;
        const ctxIdentity = resolvedChat.contextIdentity;
        new ClientApiDataSource().getUsername({
          contextId: ctxId,
          executorPublicKey: ctxIdentity,
          userId: ctxIdentity,
        }).then((usernameResponse) => {
          const syncAction = getContextProfileSyncAction({
            globalName: messengerName,
            contextUsername: usernameResponse.data || "",
          });
          if (syncAction === "apply-global-name") {
            new ClientApiDataSource().joinChat({
              contextId: ctxId,
              executorPublicKey: ctxIdentity,
              username: messengerName,
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    log.debug(
      "Home",
      `Active chat changed to: ${resolvedChat.name} (context: ${resolvedChat.contextId || "n/a"})`,
    );
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
    if (!storedSession) {
      return;
    }

    mainMessages.clear();
    threadMessages.clear();

    const timer = setTimeout(() => {
      void updateSelectedActiveChat(storedSession);
    }, SUBSCRIPTION_INIT_DELAY_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastDMSelectionRef = useRef<{
    contextId: string;
    timestamp: number;
  } | null>(null);

  // Stable ref for fetchDms that includes groupId
  const fetchDmsWithGroup = useCallback(() => {
    const gid = getGroupId();
    if (gid) return dmsHook.fetchDms(gid);
    return Promise.resolve([]);
  }, [dmsHook]);

  const channelsDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const dmsDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const membersDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const groupMembersDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const fetchGroupChannels = useCallback(() => {
    const gid = getGroupId();
    if (gid) groupContextsHook.fetchGroupContexts(gid);
  }, [groupContextsHook]);

  const fetchChannelsRef = useRef(fetchGroupChannels);
  const fetchDmsRef = useRef(fetchDmsWithGroup);
  const fetchMembersRef = useRef(chatMembersHook.fetchMembers);
  const fetchGroupMembersRef = useRef(groupMembersHook.fetchGroupMembers);

  fetchChannelsRef.current = fetchGroupChannels;
  fetchDmsRef.current = fetchDmsWithGroup;
  fetchMembersRef.current = chatMembersHook.fetchMembers;
  fetchGroupMembersRef.current = groupMembersHook.fetchGroupMembers;

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

  const debouncedFetchGroupMembers = useCallback(async () => {
    clearTimeout(groupMembersDebounceRef.current);
    groupMembersDebounceRef.current = setTimeout(() => {
      const groupId = getGroupId();
      if (groupId) {
        fetchGroupMembersRef.current(groupId);
      }
    }, 3000);
  }, []);

  const mainMessagesRef = useRef(mainMessages);
  const threadMessagesRef = useRef(threadMessages);
  const playSoundForMessageRef = useRef(playSoundForMessage);
  const notifyMessageRef = useRef(notifyMessage);
  const notifyDMRef = useRef(notifyDM);
  const notifyChannelRef = useRef(notifyChannel);
  const onDMSelectedRef = useRef<
    (dm: DMContextInfo) => void
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
    fetchGroupMembers: { current: debouncedFetchGroupMembers },
  }).current;

  const updateSelectedActiveChatRef = useRef(updateSelectedActiveChat);
  updateSelectedActiveChatRef.current = updateSelectedActiveChat;

  const onDMSelected = useCallback(
    async (dm: DMContextInfo) => {
      const contextId = dm.contextId;
      const groupId = getGroupId();

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

      let selectedDm = dm;
      let resolvedIdentity = dm.contextIdentity || dm.myIdentity;

      if (!dm.isJoined) {
        if (!groupId) {
          return;
        }

        const groupApi = new GroupApiDataSource();
        const joinResponse = await groupApi.joinGroupContext(groupId, {
          contextId,
        });
        if (joinResponse.error || !joinResponse.data) {
          log.warn(
            "Home",
            `Failed to join DM context ${contextId}: ${joinResponse.error?.message || "unknown error"}`,
          );
          return;
        }

        resolvedIdentity = joinResponse.data.memberPublicKey;
        const refreshedDms = await fetchDmsWithGroup();
        const refreshedDm = refreshedDms.find(
          (entry) => entry.contextId === contextId,
        );
        selectedDm =
          refreshedDm ??
          {
            ...dm,
            contextIdentity: resolvedIdentity,
            myIdentity: resolvedIdentity,
            isJoined: true,
          };
      }

      const selectedChat: ActiveChat = {
        type: "direct_message",
        contextId,
        id: contextId,
        name: getDmDisplayName(selectedDm),
        username: selectedDm.otherUsername || undefined,
        readOnly: false,
        isSynced: true,
        contextIdentity: resolvedIdentity,
      };

      if (resolvedIdentity) {
        setContextId(contextId);
        setExecutorPublicKey(resolvedIdentity);
      }

      mainMessagesRef.current.clear();
      threadMessagesRef.current.clear();

      await updateSelectedActiveChatRef.current(selectedChat);
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
    (ch) => (ch.isJoined ?? false) && (!ch.info || ch.info.context_type === "Channel"),
  );

  const privateDMs = dmsHook.dms;

  const chatMembers = chatMembersHook.members;
  const currentMemberIdentity =
    currentGroupPermissions.memberIdentity || getGroupMemberIdentity(currentGroupId);
  const dmMembers = useMemo(
    () =>
      buildDmMemberOptions({
        groupMembers: groupMembersHook.members,
        currentMemberIdentity,
        labelsByIdentity: chatMembers,
      }),
    [
      groupMembersHook.members,
      currentMemberIdentity,
      chatMembers,
    ],
  );

  const {
    handleThreadMessageUpdates,
    handleStateMutation,
  } = useChatHandlers(activeChatRef, activeChat, chatHandlersRefs);

  useWebSocketEvents(useCallback(async (event: WebSocketEvent) => {
    try {
      await handleStateMutation(event);

      if (openThread) {
        const sessionChat = getStoredSession();
        const useDM = sessionChat?.type === "direct_message";

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
        chatMembersHook.fetchMembers(),
      ];

      if (groupId) {
        fetchPromises.push(groupMembersHook.fetchGroupMembers(groupId));
        fetchPromises.push(groupContextsHook.fetchGroupContexts(groupId));
        fetchPromises.push(dmsHook.fetchDms(groupId));
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
  }, [dmsHook, chatMembersHook, groupContextsHook, groupMembersHook]);

  // Subscribe to ALL group contexts + DM contexts for real-time updates
  useEffect(() => {
    if (!app) return;

    const contextIdsToSubscribe: string[] = [];

    // Add all group context IDs (each channel is its own context now)
    const joinedChannelContextIds = groupContextsHook.channels
      .filter((channel) => channel.isJoined)
      .map((channel) => channel.contextId);

    if (joinedChannelContextIds.length > 0) {
      joinedChannelContextIds.forEach((id) => {
        if (id && !contextIdsToSubscribe.includes(id)) {
          contextIdsToSubscribe.push(id);
        }
      });
      log.debug(
        "Home",
        `Adding ${joinedChannelContextIds.length} joined group contexts for subscription`,
      );
    }

    // Add DM contexts (group-based DMs are also group contexts)
    if (privateDMs && privateDMs.length > 0) {
      privateDMs.forEach((dm) => {
        if (dm.contextId && !contextIdsToSubscribe.includes(dm.contextId)) {
          contextIdsToSubscribe.push(dm.contextId);
        }
      });
      log.debug("Home", `Added ${privateDMs.length} DM contexts`);
    }

    if (contextIdsToSubscribe.length > 0) {
      log.info(
        "Home",
        `Subscribing to ${contextIdsToSubscribe.length} contexts (${joinedChannelContextIds.length} channels + ${privateDMs.length} DMs)`,
        { totalContexts: contextIdsToSubscribe.length },
      );
      webSocket.subscribeToContexts(contextIdsToSubscribe);
    } else {
      log.warn("Home", "No contexts to subscribe to");
    }
  }, [app, groupContextsHook.channels, privateDMs, webSocket]);

  const onJoinedChat = async () => {
    fetchGroupChannels();
    await fetchDmsWithGroup();
    const activeChatCopy = { ...activeChat };
    if (activeChatCopy && activeChat) {
      activeChatCopy.canJoin = false;
      activeChatCopy.requiresProfileSetup = false;
      activeChatCopy.type = activeChat.type;
      activeChatCopy.id = activeChat.id;
      activeChatCopy.name = activeChat.name;
      activeChatCopy.readOnly = activeChat.readOnly;
    }
    setActiveChat(activeChatCopy as ActiveChat);
    activeChatRef.current = activeChatCopy as ActiveChat;
    updateSessionChat(activeChatCopy as ActiveChat);
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

  /**
   * Create a DM using the group-based flow:
   * 1. Create a context in the group with type "Dm"
   * 2. Set visibility to restricted
   * 3. Add both participants to the allowlist
   * The other user discovers the DM via the group context list and joins.
   */
  const createDM = async (otherIdentity: string): Promise<CreateContextResult> => {
    const groupId = getGroupId();
    if (!groupId) {
      return { data: "", error: "No group ID configured" };
    }

    try {
      const nodeApi = new ContextApiDataSource();
      const groupApi = new GroupApiDataSource();
      const identityResponse = await groupApi.resolveCurrentMemberIdentity(
        groupId,
        getGroupMemberIdentity(groupId),
      );
      const myIdentity = identityResponse.data?.memberIdentity || "";
      if (!myIdentity) {
        return {
          data: "",
          error:
            identityResponse.error?.message ||
            "Could not resolve your workspace identity",
        };
      }
      setGroupMemberIdentity(groupId, myIdentity);
      if (myIdentity === otherIdentity) {
        return {
          data: "",
          error: "Select another workspace member to start a DM",
        };
      }
      const otherUsername = dmMembers.get(otherIdentity) || chatMembers.get(otherIdentity) || "";

      const createResponse = await createDmContextInGroup({
        applicationId: getApplicationId(),
        groupId,
        myIdentity,
        otherIdentity,
        otherUsername,
        contextApi: nodeApi,
        groupApi,
        onWarning: (message) => log.warn("createDM", message),
      });
      if (createResponse.error || !createResponse.data) {
        return {
          data: "",
          error: createResponse.error || "Failed to create DM context",
        };
      }

      await fetchDmsWithGroup();
      fetchGroupChannels();

      return { data: "DM created successfully", error: "" };
    } catch (error) {
      console.error("createDM failed:", error);
      return {
        data: "",
        error: error instanceof Error ? error.message : "Failed to create DM",
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
      dmMembers={dmMembers}
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
