import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface Notification {
  id: string;
  title: string;
  description?: string;
  variant?: "info" | "warning" | "success" | "error" | "announcement";
  priority?: "low" | "medium" | "high";
  status: "unread" | "read" | "archived";
  category?: "system" | "user";
  timestamp: Date;
  // Navigation metadata
  metadata?: {
    messageId?: string;
    channelId?: string;
    channelName?: string;
    dmUserId?: string;
    dmUsername?: string;
    senderId?: string;
    senderUsername?: string;
    isMention?: boolean;
    type?: "dm" | "channel" | "mention" | "message";
  };
}

interface NotificationsContextValue {
  notifications: Notification[];
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "status"> & {
      status?: "unread" | "read" | "archived";
    },
  ) => string;
  markAsRead: (id: string) => void;
  archive: (id: string) => void;
  archiveAll: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  markAllAsRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const NOTIFICATIONS_STORAGE_KEY = "curb-chat-notifications";
const MAX_NOTIFICATIONS = 100;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const loadedNotifications = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
        
        // Clean up any self-notifications (from the bug that's now fixed)
        // Check if notification title contains current user's username
        const currentUsername = localStorage.getItem("chat-username");
        if (currentUsername) {
          // Filter out notifications that are from the current user to themselves
          // e.g. "New DM from {currentUsername}" or "{currentUsername} in #channel"
          return loadedNotifications.filter((n: Notification) => {
            const title = n.title.toLowerCase();
            const username = currentUsername.toLowerCase();
            
            // Skip notifications that start with "new dm from {username}" or "{username} in"
            const isSelfNotification = 
              title.includes(`new dm from ${username}`) ||
              title.startsWith(username);
            
            return !isSelfNotification;
          });
        }
        
        return loadedNotifications;
      }
    } catch (error) {
      console.error("Failed to load notifications from localStorage:", error);
    }
    return [];
  });

  // Clean up self-notifications on mount (for existing sessions)
  useEffect(() => {
    const currentUsername = localStorage.getItem("chat-username");
    if (currentUsername && notifications.length > 0) {
      const cleaned = notifications.filter((n: Notification) => {
        const title = n.title.toLowerCase();
        const username = currentUsername.toLowerCase();
        
        // Skip notifications that start with "new dm from {username}" or "{username} in"
        const isSelfNotification = 
          title.includes(`new dm from ${username}`) ||
          title.startsWith(username);
        
        return !isSelfNotification;
      });
      
      // Only update if we actually removed some notifications
      if (cleaned.length !== notifications.length) {
        console.log(`Cleaned up ${notifications.length - cleaned.length} self-notifications`);
        setNotifications(cleaned);
      }
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    try {
      localStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(notifications),
      );
    } catch (error) {
      console.error("Failed to save notifications to localStorage:", error);
    }
  }, [notifications]);

  const addNotification = useCallback(
    (
      notification: Omit<Notification, "id" | "timestamp" | "status"> & {
        status?: "unread" | "read" | "archived";
      },
    ) => {
      const newNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        status: notification.status || "unread",
      };

      setNotifications((prev) => {
        // Add new notification at the beginning
        const updated = [newNotification, ...prev];
        // Keep only the most recent MAX_NOTIFICATIONS
        return updated.slice(0, MAX_NOTIFICATIONS);
      });

      return newNotification.id;
    },
    [],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" as const } : n)),
    );
  }, []);

  const archive = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, status: "archived" as const } : n,
      ),
    );
  }, []);

  const archiveAll = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: "archived" as const })),
    );
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: "read" as const })),
    );
  }, []);

  const value: NotificationsContextValue = {
    notifications,
    addNotification,
    markAsRead,
    archive,
    archiveAll,
    deleteNotification,
    clearAll,
    markAllAsRead,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}

