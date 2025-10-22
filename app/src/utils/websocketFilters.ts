import type { WebSocketEvent } from '../types/WebSocketTypes';
import type { ActiveChat } from '../types/Common';

/**
 * Filter functions for WebSocket events to skip irrelevant processing
 */

/**
 * Check if event is relevant for the current chat
 */
export function isEventRelevantForChat(
  event: WebSocketEvent,
  activeChat: ActiveChat | null
): boolean {
  if (!activeChat) return false;

  // StateMutations are always relevant (they contain message updates)
  if (event.type === 'StateMutation') {
    return true;
  }

  // ExecutionEvents - only some are relevant
  if (event.type === 'ExecutionEvent' && event.data?.events) {
    const executionEvents = event.data.events;
    
    // Check if any of the execution events are relevant
    for (const execEvent of executionEvents) {
      switch (execEvent.kind) {
        case 'MessageSent':
          // Only relevant if it's not from us (we handle optimistic updates)
          return false;
        case 'ChannelCreated':
          // Always relevant - need to update channel list
          return true;
        case 'UserJoined':
        case 'UserLeft':
          // Only relevant for channels we're in
          return true;
        default:
          return false;
      }
    }
  }

  return false;
}

/**
 * Determine event priority for processing order
 */
export function getEventPriority(event: WebSocketEvent): number {
  // Lower number = higher priority

  if (event.type === 'StateMutation') {
    return 1; // Highest priority - contains message updates
  }

  if (event.type === 'ExecutionEvent' && event.data?.events) {
    const executionEvents = event.data.events;
    
    for (const execEvent of executionEvents) {
      switch (execEvent.kind) {
        case 'MessageSent':
          return 2; // High priority
        case 'ChannelCreated':
          return 3; // Medium priority
        case 'UserJoined':
        case 'UserLeft':
          return 4; // Lower priority
        default:
          return 5; // Lowest priority
      }
    }
  }

  return 10; // Unknown events - lowest priority
}

/**
 * Check if two events are duplicates
 */
export function areEventsDuplicate(event1: WebSocketEvent, event2: WebSocketEvent): boolean {
  // Same type is a prerequisite
  if (event1.type !== event2.type) {
    return false;
  }

  // For StateMutations, they're duplicates if within 50ms of each other
  // (we only need the latest state)
  if (event1.type === 'StateMutation' && event2.type === 'StateMutation') {
    const timestamp1 = Number(event1.data?.timestamp || event1.timestamp || 0);
    const timestamp2 = Number(event2.data?.timestamp || event2.timestamp || 0);
    
    return Math.abs(timestamp1 - timestamp2) < 50;
  }

  // For other events, compare the full data structure
  return JSON.stringify(event1.data) === JSON.stringify(event2.data);
}

/**
 * Deduplicate an array of events
 */
export function deduplicateEvents(events: WebSocketEvent[]): WebSocketEvent[] {
  const seen = new Set<string>();
  const unique: WebSocketEvent[] = [];

  for (const event of events) {
    const key = `${event.type}-${JSON.stringify(event.data)}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }

  return unique;
}

/**
 * Coalesce multiple StateMutation events into one
 * Since StateMutations trigger a full refresh, we only need the latest
 */
export function coalesceStateMutations(events: WebSocketEvent[]): WebSocketEvent[] {
  const stateMutations: WebSocketEvent[] = [];
  const otherEvents: WebSocketEvent[] = [];

  for (const event of events) {
    if (event.type === 'StateMutation') {
      stateMutations.push(event);
    } else {
      otherEvents.push(event);
    }
  }

  // If we have multiple StateMutations, keep only the last one
  const coalescedEvents = [...otherEvents];
  if (stateMutations.length > 0) {
    coalescedEvents.push(stateMutations[stateMutations.length - 1]);
  }

  return coalescedEvents;
}

