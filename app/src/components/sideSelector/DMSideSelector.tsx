import { memo } from "react";
import { styled } from "styled-components";
import DMHeader from "./DMHeader";
import UserList from "./UserList";
import type { DMContextInfo } from "../../hooks/useDMs";
import type { CreateContextResult } from "../popups/StartDMPopup";

const DMContainer = styled.div`
  background-color: #0e0e10;
  padding-bottom: 1rem;
  @media (max-width: 1024px) {
    width: 100%;
  }
`;

interface DMSideSelectorProps {
  dmMembers: Map<string, string>;
  createDM: (value: string) => Promise<CreateContextResult>;
  onDMSelected: (dm: DMContextInfo) => void;
  selectedDM: string;
  privateDMs: DMContextInfo[];
  isCollapsed?: boolean;
  onNoActiveChat: () => void;
}

function DMSideSelector({
  dmMembers,
  createDM,
  onDMSelected,
  selectedDM,
  privateDMs,
  isCollapsed,
  onNoActiveChat,
}: DMSideSelectorProps) {
  return (
    <DMContainer>
      <DMHeader
        key="dm-header"
        createDM={createDM}
        availableMembers={dmMembers}
        isCollapsed={isCollapsed}
      />
      <UserList
        selectedDM={selectedDM}
        onDMSelected={onDMSelected}
        privateDMs={privateDMs}
        isCollapsed={isCollapsed}
        onNoActiveChat={onNoActiveChat}
      />
    </DMContainer>
  );
}

export default memo(DMSideSelector);
