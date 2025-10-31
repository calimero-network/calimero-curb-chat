//! Member Management Implementation
//!
//! Handles member operations: join, list members, usernames.

use calimero_sdk::app;
use std::collections::HashMap;
use crate::state::CurbChat;
use crate::models::message::UserId;
use crate::models::channel::Channel;
use crate::constants::error_messages;
use crate::events::Event;
use crate::traits::Validator;
use calimero_storage::collections::{UnorderedMap, Vector};

#[app::logic]
impl CurbChat {
    pub fn join_chat(&mut self, username: String, is_dm: bool) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        if self.members.contains(&executor_id).unwrap_or(false) {
            return Err(error_messages::ALREADY_MEMBER.to_string());
        }

        self.validate_username(&username, is_dm)?;

        let _ = self.members.insert(executor_id);
        let _ = self.member_usernames.insert(executor_id, username);

        self.add_user_to_default_channels(&executor_id);

        app::emit!(Event::ChatJoined(executor_id.to_string()));

        Ok("Successfully joined the chat".to_string())
    }

    pub fn get_chat_usernames(&self) -> HashMap<UserId, String> {
        let mut result = HashMap::new();
        if let Ok(entries) = self.member_usernames.entries() {
            for (user_id, username) in entries {
                result.insert(user_id, username);
            }
        }
        result
    }


    pub fn get_chat_members(&self) -> Vec<UserId> {
        let mut members = Vec::new();
        if let Ok(iter) = self.members.iter() {
            for member in iter {
                members.push(member);
            }
        }
        members
    }

    pub fn get_chat_name(&self) -> String {
        self.name.clone()
    }

    /// Adds a new user to all default channels
    pub(crate) fn add_user_to_default_channels(&mut self, user_id: &UserId) {
        use crate::models::channel::ChannelType;
        use crate::models::tracking::UserChannelUnread;

        // Collect channels to update to avoid borrow checker issues
        let mut channels_to_update: Vec<(Channel, usize)> = Vec::new();

        if let Ok(entries) = self.channels.entries() {
            for (channel, channel_info) in entries {
                if channel_info.channel_type == ChannelType::Default {
                    let msg_count = channel_info.messages.len().unwrap_or(0);
                    channels_to_update.push((channel, msg_count));
                }
            }
        }

        // OOP: Add user to each channel and initialize tracking
        for (channel, msg_count) in channels_to_update {
            if let Ok(Some(mut channel_info)) = self.channels.get(&channel) {
                // Add user to channel's members
                let _ = channel_info.members.insert(*user_id);
                
                // Initialize unread tracking for this user in this channel
                let unread_info = UserChannelUnread {
                    last_read_timestamp: 0,
                    unread_count: msg_count as u32,
                };
                let _ = channel_info.unread_tracking.insert(*user_id, unread_info);
                
                // Initialize mentions tracking for this user in this channel
                let _ = channel_info.mentions_tracking.insert(*user_id, Vector::new());
                
                let _ = self.channels.insert(channel, channel_info);
            }
        }
    }

    pub(crate) fn initialize_mentions_tracking_for_user_in_channels(&mut self, user_id: &UserId) {
        // OOP: This is now handled in add_user_to_default_channels
        // Keeping for compatibility - it initializes mentions in channels where user is a member
        let mut channels_to_initialize = Vec::new();
        if let Ok(entries) = self.channels.entries() {
            for (channel, channel_info) in entries {
                if channel_info.members.contains(user_id).unwrap_or(false) {
                    channels_to_initialize.push(channel.clone());
                }
            }
        }

        for channel in channels_to_initialize {
            if let Ok(Some(mut channel_info)) = self.channels.get(&channel) {
                if channel_info.mentions_tracking.get(user_id).ok().flatten().is_none() {
                    let _ = channel_info.mentions_tracking.insert(*user_id, Vector::new());
                    let _ = self.channels.insert(channel, channel_info);
                }
            }
        }
    }

}

