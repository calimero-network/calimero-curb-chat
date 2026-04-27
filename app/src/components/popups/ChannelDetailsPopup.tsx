import React, { useEffect, useState } from "react";
import type { ActiveChat, ChannelMeta } from "../../types/Common";
import DetailsContainer from "../settings/DetailsContainer";
import BaseModal from "../common/popups/BaseModal";
import type { ChannelInfo, UserId } from "../../api/clientApi";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import { useGroupAdmin } from "../../hooks/useGroupAdmin";
import { getGroupId, getGroupMemberIdentity } from "../../constants/config";
import type { GroupMember } from "../../api/groupApi";

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
  const {
    members: groupMembers,
    actionLoading,
    fetchAll,
    removeMember,
    setMemberCapabilities,
    getMemberCapabilities,
  } = useGroupAdmin();

  const channelName = chat.type === "channel" ? chat.name : chat.id;

  const currentIdentity = groupId ? getGroupMemberIdentity(groupId) : "";
  const isAdmin =
    !!currentIdentity &&
    groupMembers.some(
      (m: GroupMember) =>
        m.identity === currentIdentity &&
        String(m.role ?? "").toLowerCase() === "admin",
    );

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

  const handleLeaveChannel = async () => {
    await new ClientApiDataSource().leaveChannel({
      channel: { name: channelName },
    });
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
      selectedTabIndex={selectedTabIndex}
      userList={channelUserList ?? new Map()}
      nonInvitedUserList={nonInvitedUserList}
      channelMeta={channelMeta}
      handleLeaveChannel={handleLeaveChannel}
      addMember={() => {}}
      promoteModerator={() => {}}
      removeUserFromChannel={() => {}}
      reFetchChannelMembers={reFetchChannelMembers}
      groupId={groupId}
      groupMembers={groupMembers}
      isAdmin={isAdmin}
      actionLoading={actionLoading}
      onRemoveMember={removeMember}
      onSetCapabilities={setMemberCapabilities}
      onGetCapabilities={getMemberCapabilities}
      onRefreshMembers={() => groupId && void fetchAll(groupId)}
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
