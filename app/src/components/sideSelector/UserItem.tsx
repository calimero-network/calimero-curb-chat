import { useCallback, memo, useState } from "react";
import { styled } from "styled-components";
import { Avatar } from "@calimero-network/mero-ui";
import type { DMContextInfo } from "../../hooks/useDMs";
import { ContextApiDataSource } from "../../api/dataSource/nodeApiDataSource";
import { useToast } from "../../contexts/ToastContext";
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

const TrashButton = styled.button`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 80, 80, 0.1);
    color: rgba(255, 100, 100, 0.8);
  }
`;

interface UserItemProps {
  onDMSelected: (dm: DMContextInfo) => void;
  selected: boolean;
  dm: DMContextInfo;
  isCollapsed?: boolean;
  onNoActiveChat: () => void;
}

function UserItem({
  onDMSelected,
  selected,
  dm,
  isCollapsed,
  onNoActiveChat,
}: UserItemProps) {
  const { addToast } = useToast();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const displayName = getDmDisplayName({
    otherUsername: dm.otherUsername,
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

  const confirmDelete = useCallback(async () => {
    try {
      const node = new ContextApiDataSource();
      const del = await node.deleteContext({ contextId: dm.contextId });
      if (del.error) {
        addToast({ title: "DM", message: del.error.message || "Failed to delete DM context", type: "dm", duration: 3000 });
        return;
      }
      addToast({ title: "DM", message: "DM deleted", type: "dm", duration: 2500 });
      onNoActiveChat();
    } catch {
      addToast({ title: "DM", message: "Failed to delete DM", type: "dm", duration: 3000 });
    }
  }, [dm, addToast, onNoActiveChat]);

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
            <ConfirmPopup
              title="Delete DM"
              message="This will delete the DM context. Are you sure?"
              confirmLabel="Delete"
              cancelLabel="Cancel"
              onConfirm={confirmDelete}
              onCancel={() => {}}
              toggle={
                <TrashButton
                  title="Delete DM"
                  aria-label="Delete DM"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleteOpen(true);
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </TrashButton>
              }
              isOpen={isDeleteOpen}
              setIsOpen={setIsDeleteOpen}
              isChild
            />
          </ActionsContainer>
        </>
      )}
    </UserListItem>
  );
}

export default memo(UserItem);
