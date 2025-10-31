//! Message Management Implementation
//!
//! Handles message operations: send, edit, delete, get messages.

use calimero_sdk::{app, env};
use crate::state::CurbChat;
use crate::models::message::{Message, MessageId, UserId, MessageWithReactions};
use crate::models::channel::Channel;
use crate::models::response::FullMessageResponse;
use crate::constants::error_messages;
use crate::events::{Event, MessageSentEvent};
use crate::traits::{Paginator, ResponseBuilder, EventEmitter};
use calimero_storage::collections::{Vector, UnorderedMap, LwwRegister};

#[app::logic]
impl CurbChat {
    pub fn send_message(
        &mut self,
        channel: Channel,
        text: String,
        mentions: Vec<UserId>,
        parent_id: Option<MessageId>,
    ) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();
        let timestamp = env::time_now();
        let username = self.get_username(executor_id);

        if let Some(parent_msg_id) = &parent_id {
            // OOP: Thread message - find parent message in channel and add to its threads
            let mut channel_info = self
                .channels
                .get(&channel)
                .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
                .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

            // Find parent message index
            let parent_index = self.find_message_by_id(&channel_info.messages, parent_msg_id)
                .map(|(idx, _)| idx)
                .ok_or_else(|| error_messages::THREAD_NOT_FOUND.to_string())?;

            // Get parent message
            let mut parent_message = channel_info.messages.get(parent_index)
                .map_err(|_| error_messages::THREAD_NOT_FOUND.to_string())?
                .ok_or_else(|| error_messages::THREAD_NOT_FOUND.to_string())?;

            let message_id = format!("{}:{}", parent_msg_id, parent_message.threads.len().unwrap_or(0));
            
            // CRDT: Build message using LwwRegister for scalars and Vector for collections
            let mut mentions_vec = Vector::new();
            for mention in &mentions {
                let _ = mentions_vec.push(*mention);
            }
            
            let mut mentions_usernames_vec = Vector::new();
            for mention_id in &mentions {
                let _ = mentions_usernames_vec.push(self.get_username(*mention_id));
            }

            let thread_message = Message {
                timestamp: LwwRegister::new(timestamp),
                sender: LwwRegister::new(executor_id),
                sender_username: LwwRegister::new(username),
                mentions: mentions_vec,
                mentions_usernames: mentions_usernames_vec,
                id: LwwRegister::new(message_id.clone()),
                text: LwwRegister::new(text),
                edited_on: LwwRegister::new(0),      // 0 = not edited
                deleted: LwwRegister::new(false),  // false = not deleted
                group: LwwRegister::new(channel.name.clone()),
                threads: Vector::new(),
                reactions: UnorderedMap::new(),
            };

            let _ = parent_message.threads.push(thread_message);
            let _ = channel_info.messages.update(parent_index, parent_message);
            let _ = self.channels.insert(channel.clone(), channel_info);

            self.emit_message_event(&message_id, &channel.name, true);

            Ok(message_id)
        } else {
            // Channel message
            let mut channel_info = self
                .channels
                .get(&channel)
                .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
                .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

            let message_id = format!("{}:{}", channel.name, channel_info.messages.len().unwrap_or(0));
            
            // CRDT: Build message using LwwRegister for scalars and Vector for collections
            let mut mentions_vec = Vector::new();
            for mention in &mentions {
                let _ = mentions_vec.push(*mention);
            }
            
            let mut mentions_usernames_vec = Vector::new();
            for mention_id in &mentions {
                let _ = mentions_usernames_vec.push(self.get_username(*mention_id));
            }

            // OOP: Initialize message with empty threads and reactions
            let message = Message {
                timestamp: LwwRegister::new(timestamp),
                sender: LwwRegister::new(executor_id),
                sender_username: LwwRegister::new(username),
                mentions: mentions_vec,
                mentions_usernames: mentions_usernames_vec,
                id: LwwRegister::new(message_id.clone()),
                text: LwwRegister::new(text),
                edited_on: LwwRegister::new(0),      // 0 = not edited
                deleted: LwwRegister::new(false),  // false = not deleted
                group: LwwRegister::new(channel.name.clone()),
                threads: Vector::new(),
                reactions: UnorderedMap::new(),
            };

            let _ = channel_info.messages.push(message);
            let _ = self.channels.insert(channel.clone(), channel_info);

            // Update unread counts
            self.update_unread_counts_for_new_message(&channel, timestamp, &executor_id);

            // Track mentions
            self.track_mentions_in_message(&channel, &message_id, &mentions, timestamp);

            self.emit_message_event(&message_id, &channel.name, false);

            Ok(message_id)
        }
    }

    pub fn get_messages(
        &self,
        channel: Channel,
        limit: Option<usize>,
        offset: Option<usize>,
        parent_id: Option<MessageId>,
    ) -> app::Result<FullMessageResponse, String> {
        if let Some(parent) = parent_id {
            self.get_thread_messages_paginated(&parent, limit, offset)
        } else {
            let channel_info = self
                .channels
                .get(&channel)
                .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
                .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

            Ok(self.get_channel_messages_paginated(&channel_info, limit, offset))
        }
    }

    pub fn edit_message(
        &mut self,
        message_id: MessageId,
        new_text: String,
    ) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();
        let timestamp = env::time_now();

        // Collect update location to avoid borrow checker issues
        let mut update_info: Option<(Channel, usize, Option<usize>)> = None; // (channel, msg_idx, thread_idx)

        // Try channel messages first
        if let Ok(entries) = self.channels.entries() {
            for (channel, channel_info) in entries {
                if let Some((index, message)) = self.find_message_by_id(&channel_info.messages, &message_id) {
                    // CRDT: Read sender using .get()
                    if message.sender.get() != &executor_id {
                        return Err(error_messages::ONLY_EDIT_OWN.to_string());
                    }
                    update_info = Some((channel, index, None));
                    break;
                }
            }
        }

        // OOP: Try nested thread messages if not found in channel messages
        if update_info.is_none() {
            if let Ok(entries) = self.channels.entries() {
                for (channel, channel_info) in entries {
                    if let Ok(msg_iter) = channel_info.messages.iter() {
                        for (msg_idx, parent_msg) in msg_iter.enumerate() {
                            if let Some((thread_idx, thread_msg)) = self.find_message_by_id(&parent_msg.threads, &message_id) {
                                // CRDT: Read sender using .get()
                                if thread_msg.sender.get() != &executor_id {
                                    return Err(error_messages::ONLY_EDIT_OWN.to_string());
                                }
                                update_info = Some((channel, msg_idx, Some(thread_idx)));
                                break;
                            }
                        }
                        if update_info.is_some() {
                            break;
                        }
                    }
                }
            }
        }

        // Apply the update
        if let Some((channel, msg_idx, thread_idx_opt)) = update_info {
            let mut channel_info = self.channels.get(&channel).ok().flatten().unwrap();

            if let Some(thread_idx) = thread_idx_opt {
                // Edit thread message
                let mut parent_msg = channel_info.messages.get(msg_idx).ok().flatten().unwrap();
                let mut thread_msg = parent_msg.threads.get(thread_idx).ok().flatten().unwrap();
                
                // CRDT: Set text and edited_on using LwwRegister
                let _ = thread_msg.text.set(new_text);
                let _ = thread_msg.edited_on.set(timestamp);
                
                let _ = parent_msg.threads.update(thread_idx, thread_msg);
                let _ = channel_info.messages.update(msg_idx, parent_msg);
            } else {
                // Edit channel message
                let mut message = channel_info.messages.get(msg_idx).ok().flatten().unwrap();
                
                // CRDT: Set text and edited_on using LwwRegister
                let _ = message.text.set(new_text);
                let _ = message.edited_on.set(timestamp);
                
                let _ = channel_info.messages.update(msg_idx, message);
            }

            let _ = self.channels.insert(channel, channel_info);
            Ok("Message edited successfully".to_string())
        } else {
            Err(error_messages::MESSAGE_NOT_FOUND.to_string())
        }
    }

    pub fn delete_message(&mut self, message_id: MessageId) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        // Collect update location to avoid borrow checker issues
        let mut update_info: Option<(Channel, usize, Option<usize>)> = None; // (channel, msg_idx, thread_idx)

        // Try channel messages first
        if let Ok(entries) = self.channels.entries() {
            for (channel, channel_info) in entries {
                if let Some((index, message)) = self.find_message_by_id(&channel_info.messages, &message_id) {
                    if !self.can_delete_message(&message, &executor_id) {
                        return Err(error_messages::NO_DELETE_PERMISSION.to_string());
                    }
                    update_info = Some((channel, index, None));
                    break;
                }
            }
        }

        // OOP: Try nested thread messages if not found in channel messages
        if update_info.is_none() {
            if let Ok(entries) = self.channels.entries() {
                for (channel, channel_info) in entries {
                    if let Ok(msg_iter) = channel_info.messages.iter() {
                        for (msg_idx, parent_msg) in msg_iter.enumerate() {
                            if let Some((thread_idx, thread_msg)) = self.find_message_by_id(&parent_msg.threads, &message_id) {
                                if !self.can_delete_message(&thread_msg, &executor_id) {
                                    return Err(error_messages::NO_DELETE_PERMISSION.to_string());
                                }
                                update_info = Some((channel, msg_idx, Some(thread_idx)));
                                break;
                            }
                        }
                        if update_info.is_some() {
                            break;
                        }
                    }
                }
            }
        }

        // Apply the update
        if let Some((channel, msg_idx, thread_idx_opt)) = update_info {
            let mut channel_info = self.channels.get(&channel).ok().flatten().unwrap();

            if let Some(thread_idx) = thread_idx_opt {
                // Delete thread message
                let mut parent_msg = channel_info.messages.get(msg_idx).ok().flatten().unwrap();
                let mut thread_msg = parent_msg.threads.get(thread_idx).ok().flatten().unwrap();
                
                // CRDT: Set deleted using LwwRegister
                let _ = thread_msg.deleted.set(true);
                
                let _ = parent_msg.threads.update(thread_idx, thread_msg);
                let _ = channel_info.messages.update(msg_idx, parent_msg);
            } else {
                // Delete channel message
                let mut message = channel_info.messages.get(msg_idx).ok().flatten().unwrap();
                
                // CRDT: Set deleted using LwwRegister
                let _ = message.deleted.set(true);
                
                let _ = channel_info.messages.update(msg_idx, message);
            }

            let _ = self.channels.insert(channel, channel_info);
            Ok("Message deleted successfully".to_string())
        } else {
            Err(error_messages::MESSAGE_NOT_FOUND.to_string())
        }
    }

    pub(crate) fn find_message_by_id(&self, messages: &Vector<Message>, message_id: &MessageId) -> Option<(usize, Message)> {
        if let Ok(iter) = messages.iter() {
            for (index, message) in iter.enumerate() {
                // CRDT: Compare using .get()
                if message.id.get() == message_id {
                    return Some((index, message));
                }
            }
        }
        None
    }

    fn update_unread_counts_for_new_message(&mut self, channel: &Channel, _timestamp: u64, sender_id: &UserId) {
        use crate::models::tracking::UserChannelUnread;

        // OOP: Update unread counts directly in channel's tracking
        if let Ok(Some(mut channel_info)) = self.channels.get(channel) {
            if let Ok(iter) = channel_info.members.iter() {
                for user_id in iter {
                    if user_id == *sender_id {
                        continue; // Don't increment for sender
                    }

                    let mut unread = channel_info
                        .unread_tracking
                        .get(&user_id)
                        .ok()
                        .flatten()
                        .unwrap_or(UserChannelUnread {
                            last_read_timestamp: 0,
                            unread_count: 0,
                        });

                    unread.unread_count += 1;

                    let _ = channel_info.unread_tracking.insert(user_id, unread);
                }
            }
            let _ = self.channels.insert(channel.clone(), channel_info);
        }
    }

    fn track_mentions_in_message(
        &mut self,
        channel: &Channel,
        message_id: &MessageId,
        mentions: &[UserId],
        timestamp: u64,
    ) {
        use crate::models::tracking::UserChannelMentions;

        // OOP: Track mentions directly in channel's tracking
        if let Ok(Some(mut channel_info)) = self.channels.get(channel) {
            for mentioned_user in mentions {
                let mut user_mentions = channel_info
                    .mentions_tracking
                    .get(mentioned_user)
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| Vector::new());

                let mention_info = UserChannelMentions {
                    message_id: message_id.clone(),
                    mention_count: 1,
                    mention_types: vec!["@user".to_string()],
                    timestamp,
                };

                let _ = user_mentions.push(mention_info);
                let _ = channel_info.mentions_tracking.insert(*mentioned_user, user_mentions);
            }
            let _ = self.channels.insert(channel.clone(), channel_info);
        }
    }
}

