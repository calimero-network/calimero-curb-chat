import { useState, useMemo, useCallback } from "react";
import styled from "styled-components";
import { NotificationCenter, type Notification as MeroNotification } from "@calimero-network/mero-ui";
import { useNotifications, type Notification } from "../../contexts/NotificationsContext";
import { log } from "../../utils/logger";

const NotificationButton = styled.button`
  position: relative;
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  svg {
    fill: #777583;
    width: 20px;
    height: 20px;
  }

  &:hover svg {
    fill: #fff;
  }
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: #73b30c;
  color: white;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
`;

const NotificationDropdown = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 60px;
  right: 20px;
  width: 400px;
  max-height: 600px;
  background-color: #1a1a1f;
  border: 1px solid #282933;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: ${(props) => (props.$isOpen ? "flex" : "none")};
  flex-direction: column;

  @media (max-width: 768px) {
    width: calc(100vw - 40px);
    right: 20px;
    left: 20px;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #282933;
  background-color: #16161a;
  border-radius: 8px 8px 0 0;
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: ${(props) => (props.$active ? "#fff" : "#777583")};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;

  &:hover {
    color: #fff;
  }

  ${(props) =>
    props.$active &&
    `
    &::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: #73b30c;
    }
  `}
`;

const TabBadge = styled.span`
  display: inline-block;
  margin-left: 6px;
  background-color: #73b30c;
  color: white;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
`;

const NotificationContent = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const BellIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
  </svg>
);

type TabType = "dms" | "channels";

export default function NotificationCenterWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dms");
  
  const {
    notifications,
    markAsRead,
    archive,
    archiveAll,
    deleteNotification,
    clearAll,
  } = useNotifications();

  // Filter and categorize notifications
  const { dmNotifications, channelNotifications, dmUnreadCount, channelUnreadCount, totalUnreadCount } = useMemo(() => {
    const activeNotifications = notifications.filter((n) => n.status !== "archived");
    
    const dms = activeNotifications.filter((n) => n.category === "user");
    const channels = activeNotifications.filter((n) => n.category === "system");
    
    return {
      dmNotifications: dms,
      channelNotifications: channels,
      dmUnreadCount: dms.filter((n) => n.status === "unread").length,
      channelUnreadCount: channels.filter((n) => n.status === "unread").length,
      totalUnreadCount: activeNotifications.filter((n) => n.status === "unread").length,
    };
  }, [notifications]);

  const handleNotificationClick = useCallback((notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification metadata
    if (notification.metadata) {
      const { type, channelName, channelId, dmUserId, dmUsername } = notification.metadata;
      
      log.debug("NotificationCenter", "Notification clicked:", {
        type,
        channelName,
        dmUserId,
        dmUsername,
      });
      
      // Close the notification dropdown
      setIsOpen(false);
      
      // Dispatch custom event for navigation
      // The parent component (Home/ChatContainer) should listen for this event
      const navEvent = new CustomEvent("navigate-from-notification", {
        detail: {
          type,
          channelName: channelName || channelId,
          dmUserId,
          dmUsername,
          messageId: notification.metadata.messageId,
        },
      });
      window.dispatchEvent(navEvent);
      
      log.info(
        "NotificationCenter",
        `Navigating to ${type === "dm" ? `DM with ${dmUsername}` : `#${channelName}`}`,
      );
    }
  }, [markAsRead]);

  const currentNotifications = activeTab === "dms" ? dmNotifications : channelNotifications;

  return (
    <>
      <NotificationButton
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${totalUnreadCount > 0 ? ` (${totalUnreadCount} unread)` : ""}`}
      >
        <BellIcon />
        {totalUnreadCount > 0 && (
          <NotificationBadge>{totalUnreadCount}</NotificationBadge>
        )}
      </NotificationButton>

      <NotificationDropdown $isOpen={isOpen}>
        <TabsContainer>
          <Tab 
            $active={activeTab === "dms"} 
            onClick={() => setActiveTab("dms")}
          >
            DMs
            {dmUnreadCount > 0 && <TabBadge>{dmUnreadCount}</TabBadge>}
          </Tab>
          <Tab 
            $active={activeTab === "channels"} 
            onClick={() => setActiveTab("channels")}
          >
            Channels
            {channelUnreadCount > 0 && <TabBadge>{channelUnreadCount}</TabBadge>}
          </Tab>
        </TabsContainer>

        <NotificationContent>
          <NotificationCenter
            notifications={currentNotifications as unknown as MeroNotification[]}
            onNotificationClick={handleNotificationClick as (n: MeroNotification) => void}
            onMarkAsRead={markAsRead}
            onArchive={archive}
            onArchiveAll={archiveAll}
            onDelete={deleteNotification}
            onClearAll={clearAll}
            maxNotifications={50}
            groupByDate={true}
          />
        </NotificationContent>
      </NotificationDropdown>

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
