import React from "react";
import { useCalimero, apiClient, setAppEndpointKey } from "@calimero-network/calimero-client";
import { styled } from "styled-components";
import TabbedInterface from "../../components/contextOperations/TabbedInterface";
import { Button, Input } from "@calimero-network/mero-ui";
import {
  clearStoredSession,
  clearSessionActivity,
} from "../../utils/session";
import { useState, useEffect, useCallback } from "react";
import { getInvitationFromStorage } from "../../utils/invitation";
import InvitationHandlerPopup from "../../components/popups/InvitationHandlerPopup";
import CreateWorkspacePopup from "../../components/popups/CreateWorkspacePopup";
import LandingPage from "./LandingPage";
import { getApplicationId, getApplicationPath } from "../../constants/config";

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

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }
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

const NodeConnectForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
`;


const NodeConnectLabel = styled.label`
  font-size: 0.72rem;
  font-weight: 500;
  color: #b8b8d1;
`;

const ConnectBackLink = styled.button`
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  font-size: 0.78rem;
  cursor: pointer;
  text-align: center;
  padding: 0;
  margin-top: 0.25rem;
  transition: color 0.15s;

  &:hover {
    color: rgba(255,255,255,0.6);
  }
`;

interface LoginProps {
  isAuthenticated: boolean;
  isConfigSet: boolean;
}

export default function Login({ isAuthenticated, isConfigSet }: LoginProps) {
  const { logout } = useCalimero();
  const [hasInvitation, setHasInvitation] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loggedOut, setLoggedOut] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showWebFlow, setShowWebFlow] = useState(false);
  const [nodeUrl, setNodeUrl] = useState("");
  const [connectError, setConnectError] = useState("");
  const [connecting, setConnecting] = useState(false);

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
      // Window close failed — the loggedOut message is already shown
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

  const handleUseOnWeb = async () => {
    if (window.__TAURI_INVOKE__) {
      // In Tauri: open the app URL in default browser (strip hash to avoid passing SSO tokens)
      const webUrl = window.location.href.split("#")[0];
      try {
        await window.__TAURI_INVOKE__("open_url_in_browser", { url: webUrl });
      } catch {
        // Fallback if command fails
        window.open(webUrl, "_blank");
      }
    } else {
      // In browser: show node connection form
      setShowWebFlow(true);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = nodeUrl.trim().replace(/\/$/, "");
    if (!url) {
      setConnectError("Please enter your node URL.");
      return;
    }
    try {
      new URL(url);
    } catch {
      setConnectError("That doesn't look like a valid URL.");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      const res = await fetch(`${url}/auth/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error();
    } catch {
      setConnecting(false);
      setConnectError("Node not reachable. Make sure it's running and the URL is correct.");
      return;
    }
    setAppEndpointKey(url);
    const callbackUrl = window.location.href.split("#")[0];
    try {
      await apiClient.auth().login({
        url,
        callbackUrl,
        permissions: [],
        mode: 'multi-context',
        applicationId: getApplicationId(),
        applicationPath: getApplicationPath(),
      });
      // login() sets window.location.href — page is navigating, nothing to do here
    } catch {
      setConnecting(false);
      setConnectError("Failed to reach auth service. Please try again.");
    }
  };

  if (loggedOut) {
    return <LandingPage onUseOnWeb={handleUseOnWeb} />;
  }

  if (!isAuthenticated && !isConfigSet) {
    if (showWebFlow) {
      return (
        <Wrapper>
          <Card>
            <Title>Connect to your node</Title>
            <Subtitle>
              Enter the URL of your Calimero node to continue.
            </Subtitle>
            <NodeConnectForm onSubmit={handleConnect}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <NodeConnectLabel htmlFor="nodeUrl">Node URL</NodeConnectLabel>
                <Input
                  id="nodeUrl"
                  type="text"
                  placeholder="https://node.example.com"
                  value={nodeUrl}
                  onChange={(e) => { setNodeUrl(e.target.value); setConnectError(""); }}
                  disabled={connecting}
                  autoFocus
                />
              </div>
              {connectError && (
                <div style={{ fontSize: "0.72rem", color: "#e74c3c", textAlign: "center", lineHeight: 1.5 }}>
                  {connectError}
                </div>
              )}
              <Button type="submit" disabled={connecting || !nodeUrl.trim()}>
                {connecting ? "Checking node…" : "Continue"}
              </Button>
              <ConnectBackLink type="button" onClick={() => { setShowWebFlow(false); setConnectError(""); }}>
                ← Back
              </ConnectBackLink>
            </NodeConnectForm>
          </Card>
        </Wrapper>
      );
    }
    return <LandingPage onUseOnWeb={handleUseOnWeb} />;
  }

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
