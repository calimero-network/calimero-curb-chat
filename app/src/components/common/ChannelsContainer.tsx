import React, { memo } from "react";
import type { ActiveChat, GroupContextChannel } from "../../types/Common";
import SideSelector from "../sideSelector/SideSelector";
import type { DMContextInfo } from "../../hooks/useDMs";
import type { CreateContextResult } from "../popups/StartDMPopup";

interface ChannelsContainerProps {
  onChatSelected: (chat: ActiveChat) => void;
  activeChat: ActiveChat | null;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  setIsOpenSearchChannel: () => void;
  isOpenSearchChannel: boolean;
  onDMSelected: (dm: DMContextInfo) => void;
  channels: GroupContextChannel[];
  chatMembers: Map<string, string>;
  createDM: (value: string) => Promise<CreateContextResult>;
  privateDMs: DMContextInfo[];
  onChannelCreated?: () => void;
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
    chatMembers,
    createDM,
    privateDMs,
    onChannelCreated,
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
      chatMembers={chatMembers}
      createDM={createDM}
      privateDMs={privateDMs}
      onChannelCreated={onChannelCreated}
    />
  );
}

export default memo(ChannelsContainer);
