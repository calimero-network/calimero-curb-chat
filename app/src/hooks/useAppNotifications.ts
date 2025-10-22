import { useCallback } from "react";
import { useToast } from "@calimero-network/mero-ui";
import { useNotifications } from "../contexts/NotificationsContext";
import { useNotificationSound } from "./useNotificationSound";
import type { NotificationType } from "../utils/notificationSound";

export interface AppNotification {
  title: string;
  message: string;
  type?: NotificationType;
  duration?: number;
  playSound?: boolean;
  metadata?: {
    messageId?: string;
    channelId?: string;
    channelName?: string;
    dmUserId?: string;
    dmUsername?: string;
    senderId?: string;
    senderUsername?: string;
    isMention?: boolean;
  };
}

/**
 * Custom hook that integrates sound notifications with toast notifications
 * Combines the existing sound system with Mero UI's toast system
 */
export function useAppNotifications(currentChatId?: string) {
  const { show: showToast } = useToast();
  const { addNotification } = useNotifications();
  const {
    playSoundForMessage,
    playSound,
    isEnabled: soundEnabled,
  } = useNotificationSound(
    {
      enabled: true,
      volume: 0.5,
      respectFocus: true,
      respectMute: true,
    },
    currentChatId,
  );

  /**
   * Show a notification with optional sound
   */
  const notify = useCallback(
    (notification: AppNotification) => {
      const {
        title,
        message,
        type = "message",
        duration = 5000,
        playSound: shouldPlaySound = true,
        metadata,
      } = notification;

      // Determine variant based on notification type
      const toastVariant =
        type === "mention" ? "warning" : type === "dm" ? "info" : "info";
      const notificationVariant = type === "mention" ? "warning" : "info";
      const priority =
        type === "mention" ? "high" : type === "dm" ? "medium" : "low";

      // Show toast notification (temporary)
      showToast({
        title,
        description: message,
        variant: toastVariant,
        durationMs: duration,
      });

      // Add to notification center (persistent)
      addNotification({
        title,
        description: message,
        variant: notificationVariant,
        priority,
        status: "unread",
        category: type === "dm" ? "user" : "system",
        metadata: {
          ...metadata,
          type,
        },
      });

      // Play sound if enabled
      if (shouldPlaySound && soundEnabled) {
        playSound(type);
      }
    },
    [showToast, addNotification, playSound, soundEnabled],
  );

  /**
   * Notify for a new message
   */
  const notifyMessage = useCallback(
    (
      messageId: string,
      sender: string,
      text: string,
      isMention: boolean = false,
    ) => {
      const type: NotificationType = isMention ? "mention" : "message";
      const title = isMention
        ? `${sender} mentioned you`
        : `New message from ${sender}`;

      // Truncate long messages
      const truncatedText =
        text.length > 100 ? `${text.substring(0, 100)}...` : text;

      notify({
        title,
        message: truncatedText,
        type,
      });

      // Also play sound using the existing system
      playSoundForMessage(messageId, type, isMention);
    },
    [notify, playSoundForMessage],
  );

  /**
   * Notify for a new DM
   */
  const notifyDM = useCallback(
    (messageId: string, sender: string, text: string, senderId?: string) => {
      const truncatedText =
        text.length > 100 ? `${text.substring(0, 100)}...` : text;

      notify({
        title: `New DM from ${sender}`,
        message: truncatedText,
        type: "dm",
        metadata: {
          messageId,
          dmUserId: senderId,
          dmUsername: sender,
          senderId,
          senderUsername: sender,
          isMention: false,
        },
      });

      playSoundForMessage(messageId, "dm", false);
    },
    [notify, playSoundForMessage],
  );

  /**
   * Notify for a new channel message
   */
  const notifyChannel = useCallback(
    (messageId: string, channelName: string, sender: string, text: string, senderId?: string, isMention?: boolean) => {
      const truncatedText =
        text.length > 100 ? `${text.substring(0, 100)}...` : text;

      notify({
        title: isMention ? `${sender} mentioned you in #${channelName}` : `${sender} in #${channelName}`,
        message: truncatedText,
        type: isMention ? "mention" : "channel",
        metadata: {
          messageId,
          channelId: channelName,
          channelName,
          senderId,
          senderUsername: sender,
          isMention: isMention || false,
        },
      });

      playSoundForMessage(messageId, isMention ? "mention" : "channel", isMention || false);
    },
    [notify, playSoundForMessage],
  );

  return {
    notify,
    notifyMessage,
    notifyDM,
    notifyChannel,
    playSoundForMessage,
    playSound,
  };
}
