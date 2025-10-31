//! Trait Implementations
//!
//! Implements ISP traits for CurbChat.

use calimero_sdk::app;
use crate::state::CurbChat;
use crate::models::message::{Message, MessageId, UserId, MessageWithReactions};
use crate::models::channel::{Channel, ChannelInfo};
use crate::models::response::FullMessageResponse;
use crate::constants::{MAX_USERNAME_LENGTH, error_messages};
use crate::traits::{Validator, Paginator, ResponseBuilder, EventEmitter};
use crate::events::{Event, MessageSentEvent};
use calimero_storage::collections::{UnorderedMap, UnorderedSet};
use std::collections::HashMap;

// ============================================================================
// Validator Trait Implementation
// ============================================================================

impl Validator for CurbChat {
    fn validate_username(&self, username: &str, is_dm: bool) -> Result<(), String> {
        if username.trim().is_empty() {
            return Err(error_messages::USERNAME_EMPTY.to_string());
        }

        if username.len() > MAX_USERNAME_LENGTH {
            return Err(format!(
                "Username cannot be longer than {} characters",
                MAX_USERNAME_LENGTH
            ));
        }

        if !is_dm {
            self.check_username_uniqueness(username)?;
        }

        Ok(())
    }

    fn check_username_uniqueness(&self, username: &str) -> Result<(), String> {
        if let Ok(entries) = self.member_usernames.entries() {
            for (_, existing_username) in entries {
                if existing_username == username {
                    return Err(error_messages::USERNAME_TAKEN.to_string());
                }
            }
        }
        Ok(())
    }

    fn validate_channel_membership(&self, channel: &Channel, user_id: &UserId) -> Result<(), String> {
        if !self.is_channel_member(channel, user_id) {
            return Err(error_messages::NOT_MEMBER.to_string());
        }
        Ok(())
    }

    fn can_delete_message(&self, message: &Message, user_id: &UserId) -> bool {
        // CRDT: Compare sender using .get()
        message.sender.get() == user_id || self.moderators.contains(user_id).unwrap_or(false)
    }
}

// ============================================================================
// Paginator Trait Implementation
// ============================================================================

impl Paginator for CurbChat {
    fn calculate_pagination_bounds(total_len: usize, limit: usize, offset: usize) -> Option<(usize, usize)> {
        if offset >= total_len {
            return None;
        }
        let start = offset;
        let end = (offset + limit).min(total_len);
        Some((start, end))
    }

    fn get_thread_messages_paginated(
        &self,
        parent_id: &MessageId,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> app::Result<FullMessageResponse, String> {
        // OOP: Find parent message in channels and get its threads
        let mut parent_message: Option<Message> = None;
        if let Ok(entries) = self.channels.entries() {
            for (_, channel_info) in entries {
                if let Some((_, msg)) = self.find_message_by_id(&channel_info.messages, parent_id) {
                    parent_message = Some(msg);
                    break;
                }
            }
        }
        
        let parent = parent_message.ok_or_else(|| error_messages::THREAD_NOT_FOUND.to_string())?;
        let thread_messages = &parent.threads;

        let total_len = thread_messages.len().unwrap_or(0) as usize;
        let limit_val = limit.unwrap_or(50);
        let offset_val = offset.unwrap_or(0);

        if let Some((start, end)) = Self::calculate_pagination_bounds(total_len, limit_val, offset_val) {
            let mut messages = Vec::new();

            if let Ok(iter) = thread_messages.iter() {
                for (index, message) in iter.enumerate() {
                    if index >= start && index < end {
                        // CRDT: Extract values from LwwRegister fields using .get()
                        let msg_id = message.id.get().clone();
                        
                        // Convert Vector<UserId> to Vec<UserId>
                        let mentions_vec: Vec<_> = message.mentions.iter().ok()
                            .map(|iter| iter.collect())
                            .unwrap_or_default();
                        
                        // Convert Vector<String> to Vec<String>
                        let mentions_usernames_vec: Vec<_> = message.mentions_usernames.iter().ok()
                            .map(|iter| iter.collect())
                            .unwrap_or_default();
                        
                        let message_with_reactions = MessageWithReactions {
                            timestamp: *message.timestamp.get(),
                            sender: *message.sender.get(),
                            sender_username: message.sender_username.get().clone(),
                            mentions: mentions_vec,
                            mentions_usernames: mentions_usernames_vec,
                            id: msg_id.clone(),
                            text: message.text.get().clone(),
                            edited_on: *message.edited_on.get(),
                            reactions: self.get_message_reactions(&msg_id),
                            deleted: *message.deleted.get(),
                            thread_count: 0,
                            thread_last_timestamp: 0,
                            group: message.group.get().clone(),
                        };
                        messages.push(message_with_reactions);
                    }
                }
            }

            Ok(Self::build_message_response(total_len as u32, messages, offset_val as u32))
        } else {
            Ok(Self::empty_message_response())
        }
    }

    fn get_channel_messages_paginated(
        &self,
        channel_info: &ChannelInfo,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> FullMessageResponse {
        let total_len = channel_info.messages.len().unwrap_or(0) as usize;
        let limit_val = limit.unwrap_or(50);
        let offset_val = offset.unwrap_or(0);

        if let Some((start, end)) = Self::calculate_pagination_bounds(total_len, limit_val, offset_val) {
            let mut messages = Vec::new();

            if let Ok(iter) = channel_info.messages.iter() {
                for (index, message) in iter.enumerate() {
                    if index >= start && index < end {
                        // CRDT: Extract values from LwwRegister fields using .get()
                        let msg_id = message.id.get().clone();
                        let (thread_count, thread_last_timestamp) = self.get_thread_info(&msg_id);
                        
                        // Convert Vector<UserId> to Vec<UserId>
                        let mentions_vec: Vec<_> = message.mentions.iter().ok()
                            .map(|iter| iter.collect())
                            .unwrap_or_default();
                        
                        // Convert Vector<String> to Vec<String>
                        let mentions_usernames_vec: Vec<_> = message.mentions_usernames.iter().ok()
                            .map(|iter| iter.collect())
                            .unwrap_or_default();
                        
                        let message_with_reactions = MessageWithReactions {
                            timestamp: *message.timestamp.get(),
                            sender: *message.sender.get(),
                            sender_username: message.sender_username.get().clone(),
                            mentions: mentions_vec,
                            mentions_usernames: mentions_usernames_vec,
                            id: msg_id.clone(),
                            text: message.text.get().clone(),
                            edited_on: *message.edited_on.get(),
                            reactions: self.get_message_reactions(&msg_id),
                            deleted: *message.deleted.get(),
                            thread_count,
                            thread_last_timestamp,
                            group: message.group.get().clone(),
                        };
                        messages.push(message_with_reactions);
                    }
                }
            }

            Self::build_message_response(total_len as u32, messages, offset_val as u32)
        } else {
            Self::empty_message_response()
        }
    }
}

// ============================================================================
// ResponseBuilder Trait Implementation
// ============================================================================

impl ResponseBuilder for CurbChat {
    fn empty_message_response() -> FullMessageResponse {
        FullMessageResponse {
            total_count: 0,
            messages: Vec::new(),
            start_position: 0,
        }
    }

    fn build_message_response(total: u32, messages: Vec<MessageWithReactions>, offset: u32) -> FullMessageResponse {
        FullMessageResponse {
            total_count: total,
            messages,
            start_position: offset,
        }
    }
}

// ============================================================================
// EventEmitter Trait Implementation
// ============================================================================

impl EventEmitter for CurbChat {
    fn emit_message_event(&self, message_id: &MessageId, channel_name: &str, is_thread: bool) {
        let event_data = MessageSentEvent {
            message_id: message_id.clone(),
            channel: channel_name.to_string(),
        };

        if is_thread {
            app::emit!(Event::MessageSentThread(event_data));
        } else {
            app::emit!(Event::MessageSent(event_data));
        }
    }
}

// ============================================================================
// Helper Methods for Trait Implementations
// ============================================================================

impl CurbChat {
    fn get_message_reactions(&self, message_id: &MessageId) -> Option<HashMap<String, Vec<String>>> {
        // OOP: Find message and get its reactions
        if let Ok(entries) = self.channels.entries() {
            for (_, channel_info) in entries {
                // Check channel messages
                if let Ok(iter) = channel_info.messages.iter() {
                    for message in iter {
                        // CRDT: Compare using .get()
                        if message.id.get() == message_id {
                            return Self::convert_reactions_to_hashmap(&message.reactions);
                        }
                        // Also check thread messages
                        if let Ok(thread_iter) = message.threads.iter() {
                            for thread_msg in thread_iter {
                                if thread_msg.id.get() == message_id {
                                    return Self::convert_reactions_to_hashmap(&thread_msg.reactions);
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    fn convert_reactions_to_hashmap(reactions: &UnorderedMap<String, UnorderedSet<String>>) -> Option<HashMap<String, Vec<String>>> {
        let mut result = HashMap::new();
        if let Ok(entries) = reactions.entries() {
            for (reaction, users) in entries {
                let mut user_list = Vec::new();
                if let Ok(iter) = users.iter() {
                    for user in iter {
                        user_list.push(user);
                    }
                }
                if !user_list.is_empty() {
                    result.insert(reaction, user_list);
                }
            }
        }
        if !result.is_empty() {
            Some(result)
        } else {
            None
        }
    }

    fn get_thread_info(&self, message_id: &MessageId) -> (u32, u64) {
        // OOP: Find message and get its thread info
        if let Ok(entries) = self.channels.entries() {
            for (_, channel_info) in entries {
                if let Ok(iter) = channel_info.messages.iter() {
                    for message in iter {
                        // CRDT: Compare using .get()
                        if message.id.get() == message_id {
                            let count = message.threads.len().unwrap_or(0) as u32;
                            let last_timestamp = if count > 0 {
                                if let Ok(Some(last_msg)) = message.threads.get(count.saturating_sub(1) as usize) {
                                    // CRDT: Read timestamp using .get()
                                    *last_msg.timestamp.get()
                                } else {
                                    0
                                }
                            } else {
                                0
                            };
                            return (count, last_timestamp);
                        }
                    }
                }
            }
        }
        (0, 0)
    }
}

