import React, { useState } from "react";
import { styled, keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import BaseModal from "../common/popups/BaseModal";
import { useMero } from "@calimero-network/mero-react";
import {
  clearStoredSession,
  clearSessionActivity,
  clearNamespaceReady,
} from "../../utils/session";
import {
  clearWorkspaceSelection,
  getGroupId,
  getStoredGroupAlias,
} from "../../constants/config";
import { clearMessengerDisplayName } from "../../utils/messengerName";
import { useCurrentGroupPermissions } from "../../hooks/useCurrentGroupPermissions";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import { useToast } from "../../contexts/ToastContext";
// ─── Animations ────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Layout ────────────────────────────────────────────────────────────────────

const Container = styled.div`
  position: relative;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  animation: ${fadeIn} 0.2s ease both;

  @media (max-width: 1024px) {
    max-height: calc(100vh - 140px);
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

const TitleIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: rgba(165, 255, 17, 0.1);
  border: 1px solid rgba(165, 255, 17, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    stroke: #a5ff11;
  }
`;

const Title = styled.h2`
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.01em;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }
`;

// ─── Workspace card ────────────────────────────────────────────────────────────

const WorkspaceCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 0.75rem 0.875rem;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const WorkspaceInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
`;

const WorkspaceLabel = styled.span`
  font-size: 0.68rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const WorkspaceName = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RoleBadge = styled.span<{ $admin: boolean; $mod?: boolean }>`
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 5px;
  letter-spacing: 0.04em;
  background: ${({ $admin, $mod }) =>
    $admin ? "rgba(165, 255, 17, 0.12)" : $mod ? "rgba(124, 58, 237, 0.12)" : "rgba(255, 255, 255, 0.07)"};
  border: 1px solid ${({ $admin, $mod }) =>
    $admin ? "rgba(165, 255, 17, 0.3)" : $mod ? "rgba(124, 58, 237, 0.35)" : "rgba(255, 255, 255, 0.12)"};
  color: ${({ $admin, $mod }) =>
    $admin ? "#a5ff11" : $mod ? "#a78bfa" : "rgba(255, 255, 255, 0.55)"};
`;

// ─── Danger zone ────────────────────────────────────────────────────────────

const DangerZone = styled.div`
  margin-top: 0.75rem;
  padding: 0.75rem 0.875rem;
  background: rgba(255, 59, 59, 0.04);
  border: 1px solid rgba(255, 59, 59, 0.18);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const DangerLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 100, 100, 0.7);
`;

const LeaveWorkspaceButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  border-radius: 7px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid rgba(255, 80, 80, 0.3);
  background: rgba(255, 80, 80, 0.08);
  color: rgba(255, 110, 110, 0.85);

  &:hover {
    border-color: rgba(255, 80, 80, 0.55);
    background: rgba(255, 80, 80, 0.16);
    color: #ff7a7a;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 0.4rem;
`;

const CancelLeaveButton = styled.button`
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
`;

// ─── Session section ────────────────────────────────────────────────────────────

const LogoutSection = styled.div`
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SessionActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

const LogoutLabel = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 500;
`;

const SessionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  border-radius: 7px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
`;

const ChangeWorkspaceButton = styled(SessionButton)`
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.72);

  &:hover {
    border-color: rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
`;

const LogoutButton = styled(SessionButton)`
  border: 1px solid rgba(255, 80, 80, 0.25);
  background: rgba(255, 80, 80, 0.06);
  color: rgba(255, 100, 100, 0.8);

  &:hover {
    border-color: rgba(255, 80, 80, 0.5);
    background: rgba(255, 80, 80, 0.12);
    color: #ff6464;
  }

  svg { opacity: 0.7; }
`;

// ─── Component ─────────────────────────────────────────────────────────────────

interface SettingsPopupProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  toggle: React.ReactNode;
}

export default function SettingsPopup({
  isOpen,
  setIsOpen,
  toggle,
}: SettingsPopupProps) {
  const { logout } = useMero();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const groupId = getGroupId();
  const namespaceName = getStoredGroupAlias(groupId) || groupId.slice(0, 12) + "…";
  const { isAdmin, isModerator } = useCurrentGroupPermissions(groupId);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // ── Session handlers ────────────────────────────────────────────────────────

  const handleChangeWorkspace = () => {
    clearWorkspaceSelection();
    clearNamespaceReady();
    setIsOpen(false);
    navigate("/login");
  };

  const handleLogout = () => {
    const nodeUrl = localStorage.getItem("mero:node_url");
    clearStoredSession();
    clearSessionActivity();
    clearWorkspaceSelection();
    clearNamespaceReady();
    clearMessengerDisplayName();
    sessionStorage.clear();
    logout();
    if (nodeUrl) localStorage.setItem("mero:node_url", nodeUrl);
    setIsOpen(false);
  };

  const handleLeaveWorkspace = async () => {
    if (!groupId || leaving) return;
    setLeaving(true);
    const result = await new GroupApiDataSource().leaveNamespace(groupId);
    setLeaving(false);
    if (result.error) {
      addToast({
        title: "Leave workspace",
        message: result.error.message || "Failed to leave workspace",
        type: "channel",
        duration: 5000,
      });
      return;
    }
    addToast({
      title: "Left workspace",
      message: "You have left the workspace.",
      type: "channel",
      duration: 3000,
    });
    clearWorkspaceSelection();
    clearNamespaceReady();
    setConfirmLeave(false);
    setIsOpen(false);
    navigate("/login");
  };

  const popupContent = (
    <Container>
      <Header>
        <TitleGroup>
          <TitleIcon>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </TitleIcon>
          <Title>Settings</Title>
        </TitleGroup>
        <CloseButton onClick={() => setIsOpen(false)} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </CloseButton>
      </Header>

      {/* Workspace info */}
      <WorkspaceCard>
        <WorkspaceInfo>
          <WorkspaceLabel>Workspace</WorkspaceLabel>
          <WorkspaceName>{namespaceName}</WorkspaceName>
        </WorkspaceInfo>
        <RoleBadge $admin={isAdmin} $mod={isModerator}>{isAdmin ? "Admin" : isModerator ? "Moderator" : "Member"}</RoleBadge>
      </WorkspaceCard>

      {/* Leave workspace (danger). Hidden for admins — server-side leave
          would either fail (last-admin protection) or hand the workspace
          off to an unintended successor. Admins who want out should
          transfer ownership / promote a successor first, or delete the
          namespace via the admin panel. */}
      {!isAdmin && (
        <DangerZone>
          {confirmLeave ? (
            <>
              <DangerLabel>Leave this workspace? You'll need a new invitation to return.</DangerLabel>
              <ConfirmActions>
                <CancelLeaveButton onClick={() => setConfirmLeave(false)} disabled={leaving}>
                  Cancel
                </CancelLeaveButton>
                <LeaveWorkspaceButton onClick={handleLeaveWorkspace} disabled={leaving}>
                  {leaving ? "Leaving…" : "Confirm leave"}
                </LeaveWorkspaceButton>
              </ConfirmActions>
            </>
          ) : (
            <>
              <DangerLabel>Leave workspace</DangerLabel>
              <LeaveWorkspaceButton onClick={() => setConfirmLeave(true)}>
                Leave workspace
              </LeaveWorkspaceButton>
            </>
          )}
        </DangerZone>
      )}

      <LogoutSection>
        <LogoutLabel>Session</LogoutLabel>
        <SessionActions>
          <ChangeWorkspaceButton onClick={handleChangeWorkspace}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h13" />
              <path d="m11 4 8 8-8 8" />
            </svg>
            Change workspace
          </ChangeWorkspaceButton>
          <LogoutButton onClick={handleLogout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </LogoutButton>
        </SessionActions>
      </LogoutSection>
    </Container>
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
