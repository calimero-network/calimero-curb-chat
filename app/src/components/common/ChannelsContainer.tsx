import React, { memo } from "react";
import type { ActiveChat, GroupContextChannel } from "../../types/Common";
import SideSelector from "../sideSelector/SideSelector";
import type { DMContextInfo } from "../../hooks/useDMs";
import type { CreateContextResult } from "../popups/StartDMPopup";
import type { SubgroupEntry } from "../../api/groupApi";

interface ChannelsContainerProps {
  onChatSelected: (chat: ActiveChat) => void;
  activeChat: ActiveChat | null;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  setIsOpenSearchChannel: () => void;
  isOpenSearchChannel: boolean;
  onDMSelected: (dm: DMContextInfo) => void;
  channels: GroupContextChannel[];
  subgroups: SubgroupEntry[];
  channelsBySubgroup: Map<string, GroupContextChannel[]>;
  chatMembers: Map<string, string>;
  dmMembers: Map<string, string>;
  createDM: (value: string) => Promise<CreateContextResult>;
  privateDMs: DMContextInfo[];
  onChannelCreated?: () => void;
  onChannelSelected?: (chat: ActiveChat) => void;
}

function ChannelsContainer(props: ChannelsContainerProps) {
  const {
    onChatSelected,
    activeChat,
    isSidebarOpen,
    setIsSidebarOpen,
    setIsOpenSearchChannel,
    isOpenSearchChannel,
    onDMSelected,
    channels,
    subgroups,
    channelsBySubgroup,
    chatMembers,
    dmMembers,
    createDM,
    privateDMs,
    onChannelCreated,
    onChannelSelected,
  } = props;

  return (
    <SideSelector
      onChatSelected={onChatSelected}
      activeChat={activeChat}
      isSidebarOpen={isSidebarOpen}
      onDMSelected={onDMSelected}
      setIsSidebarOpen={setIsSidebarOpen}
      setIsOpenSearchChannel={setIsOpenSearchChannel}
      isOpenSearchChannel={isOpenSearchChannel}
      channels={channels || []}
      subgroups={subgroups}
      channelsBySubgroup={channelsBySubgroup}
      chatMembers={chatMembers}
      dmMembers={dmMembers}
      createDM={createDM}
      privateDMs={privateDMs}
      onChannelCreated={onChannelCreated}
      onChannelSelected={onChannelSelected}
    />
  );
}

export default memo(ChannelsContainer);
