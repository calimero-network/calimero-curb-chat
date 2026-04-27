import React from "react";
import { useMero, ConnectButton } from "@calimero-network/mero-react";
import { clearStoredSession, clearSessionActivity, clearNamespaceReady } from "../../utils/session";
import { useNavigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import NamespaceEntryPopup from "../../components/popups/NamespaceEntryPopup";

declare global {
  interface Window {
    __TAURI_INVOKE__?: (cmd: string, args?: unknown) => Promise<unknown>;
  }
}

interface LoginProps {
  isAuthenticated: boolean;
  isConfigSet: boolean;
}

export default function Login({ isAuthenticated, isConfigSet }: LoginProps) {
  const { logout } = useMero();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const nodeUrl = localStorage.getItem("mero:node_url");
    clearStoredSession();
    clearSessionActivity();
    clearNamespaceReady();
    sessionStorage.clear();
    logout();
    if (nodeUrl) localStorage.setItem("mero:node_url", nodeUrl);
    if (window.__TAURI_INVOKE__) {
      try { await window.__TAURI_INVOKE__("close_current_window"); } catch { /* ignore */ }
    }
    navigate("/login");
  };

  // Not connected yet — show landing with ConnectButton
  if (!isAuthenticated && !isConfigSet) {
    return <LandingPage connectButton={<ConnectButton />} />;
  }

  // Connected — show namespace entry popup over the landing background
  return (
    <LandingPage>
      <NamespaceEntryPopup
        isAuthenticated={isAuthenticated}
        isConfigSet={isConfigSet}
        onLogout={() => void handleLogout()}
      />
    </LandingPage>
  );
}
