import React, { useEffect, useMemo, useState } from "react";
import type { ActiveChat, ChannelMeta } from "../../types/Common";
import DetailsContainer from "../settings/DetailsContainer";
import BaseModal from "../common/popups/BaseModal";
import type { ChannelInfo, UserId } from "../../api/clientApi";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
import { ContextApiDataSource } from "../../api/dataSource/nodeApiDataSource";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import { getExecutorPublicKey } from "@calimero-network/calimero-client";
import { useGroupAdmin } from "../../hooks/useGroupAdmin";
import { getGroupId } from "../../constants/config";
import type { GroupMember } from "../../api/groupApi";
import { isRestrictedChannelType } from "../../utils/channelVisibility";

interface ChannelDetailsPopupProps {
  toggle: React.ReactNode;
  chat: ActiveChat;
  channelUserList?: Map<string, string>;
  nonInvitedUserList: UserId[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedTabIndex: number;
  reFetchChannelMembers: () => void;
  setActiveChat: (chat: ActiveChat | null) => void;
  fetchChannels: () => void;
  onChannelLeft?: (contextId: string) => void;
}

export default function ChannelDetailsPopup({
  chat,
  toggle,
  channelUserList,
  isOpen,
  setIsOpen,
  nonInvitedUserList,
  selectedTabIndex,
  reFetchChannelMembers,
  setActiveChat,
  fetchChannels,
  onChannelLeft,
}: ChannelDetailsPopupProps) {
  const [channelMeta, setChannelMeta] = useState<ChannelMeta>({
    name: chat.name,
    description: "",
    members: [],
    createdAt: "",
    createdBy: "",
    createdByUsername: "",
    owner: "",
    inviteOnly: false,
    type: "channel",
    channelType: "channel",
    unreadMessages: { count: 0, mentions: 0 },
    isMember: false,
    readOnly: false,
  });

  const groupId = getGroupId();
  const { members: groupMembers, fetchAll } = useGroupAdmin();

  const channelName = chat.type === "channel" ? chat.name : chat.id;

  const nonChannelMembers = useMemo(() => {
    const map = new Map<string, string>();
    groupMembers.forEach((m: GroupMember) => {
      if (m.identity && !channelUserList?.has(m.identity)) {
        map.set(m.identity, m.alias || m.identity.substring(0, 12) + "...");
      }
    });
    return map;
  }, [groupMembers, channelUserList]);

  const getChannelMetadata = async (channelName: string) => {
    const channelInfo: ResponseData<ChannelInfo> =
      await new ClientApiDataSource().getChannelInfo({
        channel: { name: channelName },
      });
    if (channelInfo.data) {
      setChannelMeta((prevMeta) => ({
        ...prevMeta,
        createdAt: new Date(channelInfo.data.created_at * 1000).toISOString(),
        createdBy: channelInfo.data.created_by,
        createdByUsername: channelInfo.data.created_by_username,
        channelType: chat.channelType || "",
      }));
    }
  };

  const currentIdentity = getExecutorPublicKey() as string;
  const isOwner = !!channelMeta.createdBy && channelMeta.createdBy === currentIdentity;
  const isRestricted = isRestrictedChannelType(channelMeta.channelType);

  const handleLeaveChannel = async () => {
    if (chat.contextId && groupId && isRestricted) {
      await new GroupApiDataSource().manageContextAllowlist(groupId, chat.contextId, {
        remove: [currentIdentity],
      });
    }
    if (chat.contextId) {
      onChannelLeft?.(chat.contextId);
    }
    setActiveChat(null);
    fetchChannels();
    setIsOpen(false);
  };

  const handleDeleteChannel = async () => {
    if (!chat.contextId) return;
    const result = await new ContextApiDataSource().deleteContext({ contextId: chat.contextId });
    if (result.error) return;
    onChannelLeft?.(chat.contextId);
    setActiveChat(null);
    fetchChannels();
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen || !chat.name) return;
    void getChannelMetadata(chat.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chat.name]);

  useEffect(() => {
    if (!isOpen) return;
    if (groupId) void fetchAll(groupId);
    reFetchChannelMembers();
  }, [isOpen, chat.contextId, groupId, fetchAll, reFetchChannelMembers]);

  const popupContent = (
    <DetailsContainer
      channelName={channelName}
      groupId={groupId ?? undefined}
      contextId={chat.contextId ?? undefined}
      selectedTabIndex={selectedTabIndex}
      userList={channelUserList ?? new Map()}
      nonInvitedUserList={nonInvitedUserList}
      nonChannelMembers={nonChannelMembers}
      channelMeta={channelMeta}
      isOwner={isOwner}
      handleLeaveChannel={handleLeaveChannel}
      handleDeleteChannel={handleDeleteChannel}
      addMember={() => {}}
      promoteModerator={() => {}}
      removeUserFromChannel={() => {}}
      reFetchChannelMembers={reFetchChannelMembers}
    />
  );

  return (
    <BaseModal
      toggle={toggle}
      content={popupContent}
      open={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}
