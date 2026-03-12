import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { AppMode, CalimeroProvider, setAppEndpointKey, setAccessToken, setRefreshToken } from "@calimero-network/calimero-client";
import { ToastProvider } from "@calimero-network/mero-ui";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { WebSocketProvider } from "./contexts/WebSocketContext.tsx";
import { log } from "./utils/logger.ts";

import 'react-photo-view/dist/react-photo-view.css';

// Pre-process Tauri SSO hash params BEFORE React mounts.
// CalimeroProvider reads localStorage on init, so tokens must be there
// before the first render — not in a useEffect which is always too late.
(function bootstrapHashParams() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const p = new URLSearchParams(hash);
  const nodeUrl    = p.get("node_url");
  const accessToken  = p.get("access_token");
  const refreshToken = p.get("refresh_token");
  if (nodeUrl)      setAppEndpointKey(nodeUrl.trim());
  if (accessToken)  setAccessToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
})();

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((_registration) => {
        log.info("ServiceWorker", "Service worker registered successfully");
      })
      .catch((error) => {
        log.error("ServiceWorker", "Service worker registration failed", error);
      });
  });
}

// Disable StrictMode in production to avoid double-rendering
// which can cause 429 errors from CalimeroProvider's auth checks
const AppWrapper = import.meta.env.DEV ? StrictMode : React.Fragment;

createRoot(document.getElementById("root")!).render(
  <AppWrapper>
    <ErrorBoundary
      onError={(error, errorInfo) => {
        log.error("App", "Uncaught error in React tree", { error, errorInfo });
      }}
    >
      <BrowserRouter>
        <CalimeroProvider
          packageName={import.meta.env.VITE_APPLICATION_PACKAGE}
          registryUrl="https://apps.calimero.network"
          mode={AppMode.MultiContext}
        >
          <WebSocketProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </WebSocketProvider>
        </CalimeroProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </AppWrapper>,
);
