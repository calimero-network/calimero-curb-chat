import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActiveChat, ChannelMeta, User } from "../../types/Common";
import DetailsContainer from "../settings/DetailsContainer";
import BaseModal from "../common/popups/BaseModal";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
// import type { ResponseData } from "@calimero-network/calimero-client";
import { defaultActiveChat } from "../../mock/mock";
import { getExecutorPublicKey } from "@calimero-network/calimero-client";

interface ChannelDetailsPopupProps {
  toggle: React.ReactNode;
  chat: ActiveChat;
  channelMeta?: ChannelMeta;
  channelUserList?: Record<string, string>;
  nonInvitedUserList: Record<string, string>;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedTabIndex: number;
  reFetchChannelMembers: () => void;
  setActiveChat: (chat: ActiveChat) => void;
  fetchChannels: () => void;
}

export default function ChannelDetailsPopup({
  chat,
  toggle,
  channelMeta: channelMetaProp,
  channelUserList,
  isOpen,
  setIsOpen,
  nonInvitedUserList,
  selectedTabIndex,
  reFetchChannelMembers,
  setActiveChat,
  fetchChannels,
}: ChannelDetailsPopupProps) {
  const [channelMeta, setChannelMeta] = useState<ChannelMeta>({
    name: chat.name,
    description: "",
    members: [],
    moderators: [],
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
  const channelName = chat.type === "channel" ? chat.name : chat.id;
  const currentUserId = getExecutorPublicKey() || "";
  const isOwner = channelMeta.createdBy === currentUserId;

  const handleLeaveChannel = async () => {
    await new ClientApiDataSource().leaveChannel({
      channel: { name: channelName },
    });
    setActiveChat(defaultActiveChat);
    fetchChannels();
    setIsOpen(false);
  };

  useEffect(() => {
    if (channelMetaProp) {
      setChannelMeta((prev) => ({
        ...prev,
        ...channelMetaProp,
        channelType:
          channelMetaProp.channelType ?? chat.channelType ?? prev.channelType,
      }));
    } else if (chat.channelMeta) {
      setChannelMeta((prev) => ({
        ...prev,
        ...chat.channelMeta,
        channelType:
          chat.channelMeta?.channelType ?? chat.channelType ?? prev.channelType,
      }));
    }
  }, [channelMetaProp, chat.channelMeta, chat.channelType]);

  const membersForDisplay = useMemo(() => {
    if (channelMeta.members?.length) {
      return channelMeta.members;
    }
    if (channelUserList) {
      return Object.entries(channelUserList).map(([id, name]) => ({
        id,
        name,
        moderator: channelMeta.moderators?.some((mod) => mod.id === id) ?? false,
        active: true,
      }));
    }
    return [];
  }, [channelMeta.members, channelMeta.moderators, channelUserList]);

  const updateMembersState = useCallback(
    (updater: (members: User[]) => User[]) => {
      setChannelMeta((prev) => {
        const updatedMembers = updater(prev.members ?? []);
        return {
          ...prev,
          members: updatedMembers,
          moderators: updatedMembers.filter((member) => member.moderator),
        };
      });
    },
    [],
  );

  const handlePromoteModerator = useCallback(
    async (userId: string) => {
      if (userId === channelMeta.createdBy) return;
      const apiClient = new ClientApiDataSource();
      const response = await apiClient.promoteModerator({
        channel: { name: channelName },
        user: userId,
      });
      
      if (response.error) {
        console.error("Failed to promote moderator:", response.error);
        return;
      }
      
      updateMembersState((members) =>
        members.map((member) =>
          member.id === userId ? { ...member, moderator: true } : member,
        ),
      );
      await fetchChannels();
    },
    [channelMeta.createdBy, channelName, updateMembersState, fetchChannels],
  );

  const handleDemoteModerator = useCallback(
    async (userId: string) => {
      if (userId === channelMeta.createdBy) return;
      const apiClient = new ClientApiDataSource();
      const response = await apiClient.demoteModerator({
        channel: { name: channelName },
        user: userId,
      });
      
      if (response.error) {
        console.error("Failed to demote moderator:", response.error);
        return;
      }
      
      updateMembersState((members) =>
        members.map((member) =>
          member.id === userId ? { ...member, moderator: false } : member,
        ),
      );
      await fetchChannels();
    },
    [channelMeta.createdBy, channelName, updateMembersState, fetchChannels],
  );

  const handleRemoveUserFromChannel = useCallback(
    async (userId: string) => {
      if (userId === channelMeta.createdBy) return;
      const apiClient = new ClientApiDataSource();
      const response = await apiClient.removeUserFromChannel({
        channel: { name: channelName },
        user: userId,
      });
      
      if (response.error) {
        console.error("Failed to remove user from channel:", response.error);
        return;
      }
      
      updateMembersState((members) =>
        members.filter((member) => member.id !== userId),
      );
      await fetchChannels();
    },
    [channelMeta.createdBy, channelName, updateMembersState, fetchChannels],
  );

  const handleDeleteChannel = useCallback(async () => {
    const apiClient = new ClientApiDataSource();
    const response = await apiClient.deleteChannel({
      channel: { name: channelName },
    });
    
    if (response.error) {
      console.error("Failed to delete channel:", response.error);
      return;
    }
    
    setActiveChat(defaultActiveChat);
    fetchChannels();
    setIsOpen(false);
  }, [channelName, setActiveChat, fetchChannels, setIsOpen]);

  const popupContent = (
    <DetailsContainer
      channelName={channelName}
      selectedTabIndex={selectedTabIndex}
      nonInvitedUserList={nonInvitedUserList}
      channelMeta={channelMeta}
      handleLeaveChannel={handleLeaveChannel}
      addMember={() => {}}
      promoteModerator={handlePromoteModerator}
      demoteModerator={handleDemoteModerator}
      removeUserFromChannel={handleRemoveUserFromChannel}
      reFetchChannelMembers={reFetchChannelMembers}
      members={membersForDisplay}
      currentUserId={currentUserId}
      canDeleteChannel={isOwner}
      onDeleteChannel={handleDeleteChannel}
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
