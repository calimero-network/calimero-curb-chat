import { useCallback, memo, useState } from "react";
import { styled } from "styled-components";
import { Avatar } from "@calimero-network/mero-ui";
import type { DMContextInfo } from "../../hooks/useDMs";
import ConfirmPopup from "../popups/ConfirmPopup";
import { getDmDisplayName } from "../../utils/dmContext";

const UserListItem = styled.div<{
  $selected: boolean;
  $isCollapsed?: boolean;
}>`
  display: flex;
  justify-content: ${(props) => (props.$isCollapsed ? "center" : "space-between")};
  align-items: center;
  padding: 0.35rem ${(props) => (props.$isCollapsed ? "0" : "0.625rem")};
  border-radius: 7px;
  cursor: pointer;
  margin-bottom: 1px;
  transition: all 0.12s ease;
  position: relative;
  border-left: 2px solid ${(props) => (props.$selected ? "#a5ff11" : "transparent")};

  background: ${(props) => (props.$selected ? "rgba(165,255,17,0.07)" : "transparent")};
  color: ${(props) => (props.$selected ? "#fff" : "#5e5e6e")};

  &:hover {
    background: rgba(255, 255, 255, 0.05) !important;
    color: #d0d0d8 !important;
    border-left-color: ${(props) => (props.$selected ? "#a5ff11" : "rgba(165,255,17,0.3)")} !important;
  }
`;

const UserInfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
`;

const NameContainer = styled.div`
  font-size: 13.5px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ActionsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

interface UserItemProps {
  onDMSelected: (dm: DMContextInfo) => void;
  selected: boolean;
  dm: DMContextInfo;
  isCollapsed?: boolean;
}

function UserItem({
  onDMSelected,
  selected,
  dm,
  isCollapsed,
}: UserItemProps) {
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const displayName = getDmDisplayName({
    otherUsername: dm.otherUsername,
    otherAlias: dm.otherAlias,
    otherIdentity: dm.otherIdentity,
    contextId: dm.contextId,
  });

  const handleClick = useCallback(() => {
    if (!dm.isJoined) {
      setIsJoinOpen(true);
      return;
    }

    onDMSelected(dm);
  }, [dm, onDMSelected]);

  const confirmJoin = useCallback(async () => {
    await onDMSelected(dm);
  }, [dm, onDMSelected]);

  return (
    <UserListItem
      $selected={selected}
      onClick={handleClick}
      $isCollapsed={isCollapsed}
    >
      {isCollapsed ? (
        <Avatar size="xs" name={displayName} />
      ) : (
        <>
          <UserInfoContainer>
            <Avatar size="xs" name={displayName} />
            <NameContainer>{displayName}</NameContainer>
          </UserInfoContainer>
          <ActionsContainer>
            <ConfirmPopup
              title="Join DM"
              message={`Join the private DM context with ${displayName}?`}
              confirmLabel="Join DM"
              cancelLabel="Cancel"
              onConfirm={confirmJoin}
              onCancel={() => {}}
              toggle={<span />}
              isOpen={isJoinOpen}
              setIsOpen={setIsJoinOpen}
              isChild
            />
          </ActionsContainer>
        </>
      )}
    </UserListItem>
  );
}

export default memo(UserItem);
