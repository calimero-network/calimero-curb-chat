/**
 * Application-wide constants for configuration and tuning
 */

// Message pagination
export const MESSAGE_PAGE_SIZE = 20;
export const RECENT_MESSAGES_CHECK_SIZE = 5;
export const THREAD_MESSAGE_PAGE_SIZE = 20;

// Debounce and throttle timings (in milliseconds)
export const DEBOUNCE_FETCH_DELAY_MS = 1000; // For channel/DM list fetches
export const EVENT_RATE_LIMIT_MS = 100; // Minimum time between websocket events (DEPRECATED - use batching)
export const PERSISTENT_STATE_POLL_MS = 500; // Polling interval for persistent state sync

// Timeouts (in milliseconds)
export const IDLE_TIMEOUT_MS = 3600000; // 1 hour - auto-logout after inactivity
export const SUBSCRIPTION_INIT_DELAY_MS = 500; // Delay before subscribing to events
export const API_REQUEST_TIMEOUT_MS = 10000; // 10 seconds

// UI behavior (DEPRECATED - no longer needed with batching)
export const EVENT_QUEUE_MAX_SIZE = 10; // Maximum events to track
export const EVENT_QUEUE_CLEANUP_SIZE = 5; // Keep only this many when cleaning up

// WebSocket Performance
export const WS_EVENT_BATCH_WINDOW_MS = 100; // Batch events within 100ms window
export const WS_MAX_BATCH_SIZE = 10; // Maximum events per batch
export const WS_HEARTBEAT_TIMEOUT_MS = 60000; // 1 minute without events = stale
export const WS_MAX_RECONNECT_ATTEMPTS = 5; // Give up after 5 failed reconnections
export const WS_INITIAL_RECONNECT_DELAY_MS = 1000; // Start with 1 second delay
export const WS_MAX_RECONNECT_DELAY_MS = 30000; // Cap at 30 seconds

// Audio/Notifications
export const DEFAULT_NOTIFICATION_VOLUME = 0.5;
export const DEFAULT_NOTIFICATIONS_ENABLED = false;

