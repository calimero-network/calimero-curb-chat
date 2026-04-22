import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import {
  AppMode,
  CalimeroProvider,
  setAppEndpointKey,
  setAccessToken,
  setRefreshToken,
} from "@calimero-network/calimero-client";
import { MeroProvider, AppMode as MeroAppMode } from "@calimero-network/mero-react";
import "@calimero-network/mero-ui/styles.css";
import { ToastProvider } from "@calimero-network/mero-ui";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { WebSocketProvider } from "./contexts/WebSocketContext.tsx";
import { log } from "./utils/logger.ts";

import 'react-photo-view/dist/react-photo-view.css';

// Bridge mero-react storage → calimero-client storage so CalimeroProvider's
// CalimeroApplication gets the correct node URL and access token at creation time.
// Runs synchronously before React renders — effects would be too late.
(function bridgeStorageOnLoad() {
  const hash = window.location.hash.slice(1);
  if (hash) {
    // Auth callback return (web auth) or Tauri SSO — hash has the fresh tokens.
    const p = new URLSearchParams(hash);
    const accessToken = p.get('access_token');
    const refreshToken = p.get('refresh_token');
    const nodeUrl = p.get('node_url');
    if (nodeUrl) setAppEndpointKey(nodeUrl.trim());
    if (accessToken) setAccessToken(accessToken);
    if (refreshToken) setRefreshToken(refreshToken);
  } else {
    // Returning authenticated user: bridge mero-react storage keys → calimero storage keys.
    const nodeUrl = localStorage.getItem('mero:node_url');
    if (nodeUrl) setAppEndpointKey(nodeUrl);
    const raw = localStorage.getItem('mero-tokens');
    if (raw) {
      try {
        const d = JSON.parse(raw) as { access_token?: string; refresh_token?: string };
        if (d.access_token) setAccessToken(d.access_token);
        if (d.refresh_token) setRefreshToken(d.refresh_token);
      } catch { /* ignore */ }
    }
  }
})();

const CALIMERO_APP_ID_KEY = "calimero-application-id";

function getExplicitApplicationId(): string {
  const fromSearch = new URLSearchParams(window.location.search).get("app-id")?.trim();
  if (fromSearch) return fromSearch;
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("app-id")?.trim();
  if (fromHash) return fromHash;
  return (import.meta.env.VITE_APPLICATION_ID as string | undefined)?.trim() || "";
}

const explicitApplicationId = getExplicitApplicationId();
if (explicitApplicationId && !localStorage.getItem(CALIMERO_APP_ID_KEY)) {
  localStorage.setItem(CALIMERO_APP_ID_KEY, explicitApplicationId);
}

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => log.info("ServiceWorker", "Service worker registered successfully"))
      .catch((error) => log.error("ServiceWorker", "Service worker registration failed", error));
  });
}

const AppWrapper = import.meta.env.DEV ? StrictMode : React.Fragment;

createRoot(document.getElementById("root")!).render(
  <AppWrapper>
    <ErrorBoundary
      onError={(error, errorInfo) => {
        log.error("App", "Uncaught error in React tree", { error, errorInfo });
      }}
    >
      <MeroProvider
        mode={MeroAppMode.MultiContext}
        packageName={import.meta.env.VITE_APPLICATION_PACKAGE}
        registryUrl="https://apps.calimero.network"
      >
        <BrowserRouter>
          <CalimeroProvider
            mode={AppMode.MultiContext}
            packageName={import.meta.env.VITE_APPLICATION_PACKAGE}
            registryUrl="https://apps.calimero.network"
          >
            <WebSocketProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </WebSocketProvider>
          </CalimeroProvider>
        </BrowserRouter>
      </MeroProvider>
    </ErrorBoundary>
  </AppWrapper>,
);
