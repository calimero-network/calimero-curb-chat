import React, { useEffect, useMemo, useState } from "react";
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
import {
  generateInvitationDeepLink,
  generateInvitationUrl,
  serializeGroupInvitationPayload,
} from "../../utils/invitation";

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

// ─── Invite section ────────────────────────────────────────────────────────────

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const SectionLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.6rem;
`;

const InviteBox = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 0.75rem 0.875rem;
`;

const InviteRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const InviteDescription = styled.p`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0 0 0.75rem;
  line-height: 1.4;
`;

const CopyRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.625rem;
`;

const InviteStatusText = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
`;

const ActionButton = styled.button<{ $variant?: "primary" | "secondary" | "ghost" }>`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.875rem;
  border-radius: 7px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  flex: 1;
  justify-content: center;

  ${({ $variant = "secondary" }) =>
    $variant === "primary"
      ? `
    border: 1px solid rgba(165, 255, 17, 0.35);
    background: rgba(165, 255, 17, 0.08);
    color: #a5ff11;
    &:hover { background: rgba(165, 255, 17, 0.14); border-color: rgba(165, 255, 17, 0.55); }
    &:disabled { opacity: 0.4; cursor: default; }
  `
      : $variant === "ghost"
      ? `
    border: 1px solid rgba(255,255,255,0.09);
    background: transparent;
    color: rgba(255,255,255,0.55);
    &:hover { background: rgba(255,255,255,0.06); color: #fff; }
  `
      : `
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.72);
    &:hover { border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.08); color: #fff; }
    &:disabled { opacity: 0.4; cursor: default; }
  `}
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
  const groupId = getGroupId();
  const namespaceName = getStoredGroupAlias(groupId) || groupId.slice(0, 12) + "…";
  const { isAdmin, isModerator } = useCurrentGroupPermissions(groupId);

  // ── Invitation state ────────────────────────────────────────────────────────
  const [invitePayload, setInvitePayload] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"web" | "desktop" | "">("");

  const webUrl = useMemo(
    () => (invitePayload ? generateInvitationUrl(invitePayload) : ""),
    [invitePayload],
  );
  const desktopUrl = useMemo(
    () => (invitePayload ? generateInvitationDeepLink(invitePayload) : ""),
    [invitePayload],
  );

  // Reset invite state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setInvitePayload("");
      setInviteError("");
      setCopiedTarget("");
    }
  }, [isOpen]);

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    setInviteError("");
    const response = await new GroupApiDataSource().createInvitation(groupId);
    setInviteLoading(false);
    if (response.error || !response.data) {
      setInviteError(response.error?.message ?? "Failed to generate invitation");
      return;
    }
    setInvitePayload(
      serializeGroupInvitationPayload({
        invitation: response.data.invitation,
        groupAlias: response.data.groupAlias,
      }),
    );
  };

  const handleCopy = async (target: "web" | "desktop") => {
    const value = target === "web" ? webUrl : desktopUrl;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(""), 2000);
    } catch {
      prompt("Copy this invite link:", value);
    }
  };

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
