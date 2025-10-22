/**
 * Application-wide constants for configuration and tuning
 */

// Message pagination
export const MESSAGE_PAGE_SIZE = 20;
export const RECENT_MESSAGES_CHECK_SIZE = 5;
export const THREAD_MESSAGE_PAGE_SIZE = 20;

// Debounce and throttle timings (in milliseconds)
export const DEBOUNCE_FETCH_DELAY_MS = 1000; // For channel/DM list fetches
export const EVENT_RATE_LIMIT_MS = 100; // Minimum time between websocket events
export const PERSISTENT_STATE_POLL_MS = 500; // Polling interval for persistent state sync

// Timeouts (in milliseconds)
export const IDLE_TIMEOUT_MS = 3600000; // 1 hour - auto-logout after inactivity
export const SUBSCRIPTION_INIT_DELAY_MS = 500; // Delay before subscribing to events
export const API_REQUEST_TIMEOUT_MS = 10000; // 10 seconds

// UI behavior
export const EVENT_QUEUE_MAX_SIZE = 10; // Maximum events to track
export const EVENT_QUEUE_CLEANUP_SIZE = 5; // Keep only this many when cleaning up

// Audio/Notifications
export const DEFAULT_NOTIFICATION_VOLUME = 0.5;
export const DEFAULT_NOTIFICATIONS_ENABLED = false;

