import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useMero } from "@calimero-network/mero-react";
import { useEffect, lazy, Suspense } from "react";
import { LoadingSpinner } from "./components/LoadingSpinner";
import {
  isSessionExpired,
  clearStoredSession,
  clearSessionActivity,
  updateSessionActivity,
} from "./utils/session";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { ToastManager } from "./components/common/ToastManager";
import { extractInvitationFromUrl, saveInvitationToStorage } from "./utils/invitation";
import { getGroupId } from "./constants/config";
import { getAppEntryState } from "./utils/appEntry";
import { getMessengerDisplayName } from "./utils/messengerName";

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const IdleTimeoutWrapper = lazy(() => import("./components/IdleTimeoutWrapper"));

function ToastDisplay() {
  const { toasts, removeToast } = useToast();
  return <ToastManager toasts={toasts} onRemoveToast={removeToast} />;
}

function App() {
  const { isAuthenticated, isLoading, logout } = useMero();
  const navigate = useNavigate();
  const location = useLocation();

  // Clean up invitation URL parameter and save to storage
  useEffect(() => {
    const invitation = extractInvitationFromUrl();
    if (invitation) {
      saveInvitationToStorage(invitation);
      const url = new URL(window.location.href);
      url.searchParams.delete("invitation");
      window.history.replaceState({}, "", url.toString());
    }
  }, [location.pathname]);

  // Session expiry check and activity tracking
  useEffect(() => {
    if (isAuthenticated) {
      if (isSessionExpired()) {
        clearStoredSession();
        clearSessionActivity();
        logout();
      } else {
        updateSessionActivity();
      }
    }
  }, [isAuthenticated, logout]);

  // isAuthenticated from MeroProvider is the single source of truth.
  // isConfigSet was a separate calimero-client concept (has nodeUrl + JWT);
  // with mero-react, isAuthenticated already implies both are present and valid.
  const appEntryState = getAppEntryState({
    isAuthenticated,
    isConfigSet: isAuthenticated,
    groupId: getGroupId(),
    messengerName: getMessengerDisplayName(),
    activeChat: null,
  });

  const canEnterApp = appEntryState !== "login";

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ToastProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route
            path="/login"
            element={
              canEnterApp ? (
                <Navigate to="/" replace />
              ) : (
                <Login
                  isAuthenticated={isAuthenticated}
                  isConfigSet={isAuthenticated}
                />
              )
            }
          />
          <Route
            path="/"
            element={
              canEnterApp ? (
                <IdleTimeoutWrapper>
                  <Home isConfigSet={isAuthenticated} />
                </IdleTimeoutWrapper>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <ToastDisplay />
      </Suspense>
    </ToastProvider>
  );
}

export default App;
