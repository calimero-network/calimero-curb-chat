import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { AppMode, CalimeroProvider } from "@calimero-network/calimero-client";
import { APPLICATION_ID, APPLICATION_PATH } from "./constants/config.ts";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((_registration) => {
      })
      .catch((_registrationError) => {
      });
  });
}

// Disable StrictMode in production to avoid double-rendering
// which can cause 429 errors from CalimeroProvider's auth checks
const AppWrapper = import.meta.env.DEV ? StrictMode : React.Fragment;

createRoot(document.getElementById("root")!).render(
  <AppWrapper>
    <BrowserRouter>
    <CalimeroProvider
      clientApplicationId={APPLICATION_ID}
      mode={AppMode.MultiContext}
      applicationPath={APPLICATION_PATH}
    >
      <App />
    </CalimeroProvider>
    </BrowserRouter>
  </AppWrapper>
);
