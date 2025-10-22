/**
 * WebSocket event types for Calimero
 * 
 * Structure:
 * StateMutation event contains an array of specific events (MessageSent, ChannelCreated, etc.)
 */

export type ExecutionEventKind = 
  | 'MessageSent' 
  | 'ChannelCreated' 
  | 'UserJoined' 
  | 'UserLeft' 
  | string;

export interface ExecutionEventData {
  kind: ExecutionEventKind;
  data?: unknown;
}

export interface StateMutationData {
  events?: ExecutionEventData[];
  timestamp?: number;
  [key: string]: unknown;
}

export interface WebSocketEvent {
  type: 'StateMutation' | string;
  data?: StateMutationData;
  timestamp?: number;
}

export type WebSocketEventCallback = (event: WebSocketEvent) => Promise<void>;

