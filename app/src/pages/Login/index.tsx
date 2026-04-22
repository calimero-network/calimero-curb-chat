import React from "react";
import { useMero, ConnectButton } from "@calimero-network/mero-react";
import { styled } from "styled-components";
import TabbedInterface from "../../components/contextOperations/TabbedInterface";
import { Button } from "@calimero-network/mero-ui";
import {
  clearStoredSession,
  clearSessionActivity,
} from "../../utils/session";
import { useState, useEffect, useCallback } from "react";
import { getInvitationFromStorage } from "../../utils/invitation";
import InvitationHandlerPopup from "../../components/popups/InvitationHandlerPopup";
import CreateWorkspacePopup from "../../components/popups/CreateWorkspacePopup";
import LandingPage from "./LandingPage";

declare global {
  interface Window {
    __TAURI_INVOKE__?: (cmd: string, args?: unknown) => Promise<unknown>;
  }
}

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0e0e10;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  position: relative;
  overflow: hidden;
`;

export const Card = styled.div`
  background: transparent;
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 20px;
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  width: 90%;
  max-width: 450px;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    padding: 1.5rem;
    width: 95%;
    max-width: 400px;
  }
`;

export const Title = styled.h1`
  text-align: center;
  color: #ffffff;
  margin-bottom: 1rem;
  font-size: 1.6rem;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  white-space: nowrap;

  @media (max-width: 768px) {
    font-size: 1.4rem;
    margin-bottom: 0.75rem;
  }
`;

export const ConnectWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
`;

export const Subtitle = styled.h2`
  text-align: center;
  color: #b8b8d1;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  font-weight: 400;
  line-height: 1.6;
  opacity: 0.9;
`;

export const LogoutWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 1rem;
`;

const CreateWorkspaceButton = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
`;

interface LoginProps {
  isAuthenticated: boolean;
  isConfigSet: boolean;
}

export default function Login({ isAuthenticated, isConfigSet }: LoginProps) {
  const { logout } = useMero();
  const [hasInvitation, setHasInvitation] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loggedOut, setLoggedOut] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  const tabs = [{ id: "chat", label: "Chat" }];

  const refreshInvitation = useCallback(() => {
    setHasInvitation(!!getInvitationFromStorage());
  }, []);

  useEffect(() => {
    refreshInvitation();
  }, [refreshInvitation]);

  const handleLogout = async () => {
    clearStoredSession();
    clearSessionActivity();
    logout();
    localStorage.clear();
    setLoggedOut(true);
    try {
      if (window.__TAURI_INVOKE__) {
        await window.__TAURI_INVOKE__("close_current_window");
      } else {
        window.close();
      }
    } catch {
      // Window close failed — loggedOut message is already shown
    }
  };

  const handleInvitationSuccess = () => {
    setHasInvitation(false);
    setRefreshKey((prev) => prev + 1);
  };

  const handleInvitationError = () => {
    setHasInvitation(false);
  };

  const handleWorkspaceCreated = (_groupId: string) => {
    setShowCreateWorkspace(false);
    setRefreshKey((prev) => prev + 1);
  };

  // After logout: show landing page with ConnectButton
  if (loggedOut) {
    return (
      <LandingPage
        onUseOnWeb={undefined}
        connectButton={<ConnectButton />}
      />
    );
  }

  // Not authenticated: show landing page with ConnectButton as primary CTA
  if (!isAuthenticated && !isConfigSet) {
    return (
      <LandingPage
        onUseOnWeb={undefined}
        connectButton={<ConnectButton />}
      />
    );
  }

  // Authenticated but no workspace selected yet: show workspace selection
  return (
    <Wrapper>
      {hasInvitation && isAuthenticated && (
        <InvitationHandlerPopup
          onSuccess={handleInvitationSuccess}
          onError={handleInvitationError}
        />
      )}
      {showCreateWorkspace && isAuthenticated && (
        <CreateWorkspacePopup
          onSuccess={handleWorkspaceCreated}
          onCancel={() => setShowCreateWorkspace(false)}
        />
      )}
      <Card>
        <Title>Welcome to Calimero Chat</Title>
        <TabbedInterface
          key={refreshKey}
          tabs={tabs}
          isAuthenticated={isAuthenticated}
          isConfigSet={isConfigSet}
          onInvitationSaved={refreshInvitation}
        />
        {isAuthenticated && !hasInvitation && (
          <CreateWorkspaceButton>
            <Button
              onClick={() => setShowCreateWorkspace(true)}
              variant="secondary"
            >
              Create new workspace
            </Button>
          </CreateWorkspaceButton>
        )}
        {(isAuthenticated || isConfigSet) && (
          <LogoutWrapper>
            <Button onClick={handleLogout} variant="secondary">
              Logout
            </Button>
          </LogoutWrapper>
        )}
      </Card>
    </Wrapper>
  );
}
