//! Channel Management Implementation
//!
//! Handles channel operations: create, join, leave, list, invite.

use calimero_sdk::{app, env};
use std::collections::HashMap;
use crate::state::CurbChat;
use crate::models::message::UserId;
use crate::models::channel::{Channel, ChannelType, ChannelInfo, ChannelMetadata, PublicChannelMetadata};
use crate::models::response::PublicChannelInfo as ResponsePublicChannelInfo;
use crate::constants::error_messages;
use crate::events::Event;
use calimero_storage::collections::{UnorderedMap, UnorderedSet, Vector};

#[app::logic]
impl CurbChat {
    pub fn create_channel(
        &mut self,
        channel: Channel,
        channel_type: ChannelType,
    ) -> app::Result<String, String> {
        if self.is_dm {
            return Err(error_messages::CANNOT_CREATE_CHANNEL_IN_DM.to_string());
        }

        if self.channels.contains(&channel).unwrap_or(false) {
            return Err("Channel already exists".to_string());
        }

        let executor_id = self.get_executor_id();
        let created_at = env::time_now();
        let username = self.get_username(executor_id);

        let mut channel_info = ChannelInfo {
            messages: Vector::new(),
            channel_type: channel_type.clone(),
            read_only: false,
            meta: ChannelMetadata {
                created_at,
                created_by: executor_id,
                created_by_username: Some(username),
                read_only: UnorderedSet::new(),
                moderators: UnorderedSet::new(),
                links_allowed: true,
            },
            last_read: UnorderedMap::new(),
            // OOP: Initialize channel's own collections
            members: UnorderedSet::new(),
            unread_tracking: UnorderedMap::new(),
            mentions_tracking: UnorderedMap::new(),
        };

        // OOP: Add creator as member directly to channel
        let _ = channel_info.members.insert(executor_id);
        let _ = self.channels.insert(channel.clone(), channel_info);

        app::emit!(Event::ChannelCreated(channel.name.clone()));

        Ok(format!("Channel '{}' created successfully", channel.name))
    }

    pub fn get_channels(&self) -> HashMap<String, ResponsePublicChannelInfo> {
        let executor_id = self.get_executor_id();
        let mut result = HashMap::new();

        if let Ok(entries) = self.channels.entries() {
            for (channel, channel_info) in entries {
                if self.is_channel_member(&channel, &executor_id) {
                    let (unread_count, last_read_timestamp) =
                        self.get_user_channel_unread_info(&executor_id, &channel);
                    let unread_mention_count =
                        self.get_user_channel_mention_count(&executor_id, &channel);

                    let public_info = ResponsePublicChannelInfo {
                        channel_type: channel_info.channel_type.clone(),
                        read_only: channel_info.read_only,
                        created_at: channel_info.meta.created_at,
                        created_by_username: channel_info
                            .meta
                            .created_by_username
                            .clone()
                            .unwrap_or_else(|| "Unknown".to_string()),
                        created_by: channel_info.meta.created_by,
                        links_allowed: channel_info.meta.links_allowed,
                        unread_count,
                        last_read_timestamp,
                        unread_mention_count,
                    };

                    result.insert(channel.name, public_info);
                }
            }
        }

        result
    }

    pub fn get_all_channels(&self) -> HashMap<String, ResponsePublicChannelInfo> {
        let executor_id = self.get_executor_id();
        let mut result = HashMap::new();

        if let Ok(entries) = self.channels.entries() {
            for (channel, channel_info) in entries {
                let (unread_count, last_read_timestamp) =
                    self.get_user_channel_unread_info(&executor_id, &channel);
                let unread_mention_count =
                    self.get_user_channel_mention_count(&executor_id, &channel);

                let public_info = ResponsePublicChannelInfo {
                    channel_type: channel_info.channel_type.clone(),
                    read_only: channel_info.read_only,
                    created_at: channel_info.meta.created_at,
                    created_by_username: channel_info
                        .meta
                        .created_by_username
                        .clone()
                        .unwrap_or_else(|| "Unknown".to_string()),
                    created_by: channel_info.meta.created_by,
                    links_allowed: channel_info.meta.links_allowed,
                    unread_count,
                    last_read_timestamp,
                    unread_mention_count,
                };

                result.insert(channel.name, public_info);
            }
        }

        result
    }

    pub fn get_channel_members(
        &self,
        channel: Channel,
    ) -> app::Result<HashMap<UserId, String>, String> {
        let channel_info = self
            .channels
            .get(&channel)
            .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
            .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

        let mut result = HashMap::new();
        // OOP: Get members directly from channel
        if let Ok(iter) = channel_info.members.iter() {
            for member_id in iter {
                let username = self.get_username(member_id);
                result.insert(member_id, username);
            }
        }

        Ok(result)
    }

    pub fn get_channel_info(&self, channel: Channel) -> app::Result<PublicChannelMetadata, String> {
        let channel_info = self
            .channels
            .get(&channel)
            .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
            .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

        Ok(PublicChannelMetadata {
            created_at: channel_info.meta.created_at,
            created_by: channel_info.meta.created_by,
            created_by_username: channel_info
                .meta
                .created_by_username
                .unwrap_or_else(|| "Unknown".to_string()),
            links_allowed: channel_info.meta.links_allowed,
        })
    }

    pub fn invite_to_channel(
        &mut self,
        channel: Channel,
        user_id: UserId,
    ) -> app::Result<String, String> {
        if self.is_dm {
            return Err(error_messages::CANNOT_INVITE_TO_DM.to_string());
        }

        if !self.members.contains(&user_id).unwrap_or(false) {
            return Err(error_messages::USER_NOT_CHAT_MEMBER.to_string());
        }

        let mut channel_info = self
            .channels
            .get(&channel)
            .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
            .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

        // OOP: Check and add member directly to channel
        if channel_info.members.contains(&user_id).unwrap_or(false) {
            return Err(error_messages::USER_ALREADY_CHANNEL_MEMBER.to_string());
        }

        let _ = channel_info.members.insert(user_id);
        
        // Initialize mentions tracking directly in channel
        let _ = channel_info.mentions_tracking.insert(user_id, Vector::new());
        
        let _ = self.channels.insert(channel.clone(), channel_info);

        app::emit!(Event::ChannelInvited(user_id.to_string()));

        Ok(format!("User {} invited to channel {}", user_id, channel.name))
    }

    pub fn get_non_member_users(
        &self,
        channel: Channel,
    ) -> app::Result<HashMap<UserId, String>, String> {
        let channel_info = self
            .channels
            .get(&channel)
            .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
            .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

        let mut result = HashMap::new();

        // OOP: Check against channel's own members
        if let Ok(iter) = self.members.iter() {
            for member_id in iter {
                if !channel_info.members.contains(&member_id).unwrap_or(false) {
                    let username = self.get_username(member_id);
                    result.insert(member_id, username);
                }
            }
        }

        Ok(result)
    }

    pub fn join_channel(&mut self, channel: Channel) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        let mut channel_info = self
            .channels
            .get(&channel)
            .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
            .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

        if channel_info.channel_type != ChannelType::Public {
            return Err(error_messages::ONLY_JOIN_PUBLIC.to_string());
        }

        // OOP: Check and add member directly to channel
        if channel_info.members.contains(&executor_id).unwrap_or(false) {
            return Err(error_messages::ALREADY_CHANNEL_MEMBER.to_string());
        }

        let _ = channel_info.members.insert(executor_id);
        
        // Initialize mentions tracking directly in channel
        let _ = channel_info.mentions_tracking.insert(executor_id, Vector::new());
        
        let _ = self.channels.insert(channel.clone(), channel_info);

        app::emit!(Event::ChannelJoined(channel.name.clone()));

        Ok(format!("Joined channel '{}' successfully", channel.name))
    }

    pub fn leave_channel(&mut self, channel: Channel) -> app::Result<String, String> {
        if self.is_dm {
            return Err(error_messages::CANNOT_LEAVE_DM.to_string());
        }

        let executor_id = self.get_executor_id();

        let mut channel_info = self
            .channels
            .get(&channel)
            .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
            .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

        if channel_info.channel_type == ChannelType::Default {
            return Err("Cannot leave default channel".to_string());
        }

        // OOP: Check and remove member directly from channel
        if !channel_info.members.contains(&executor_id).unwrap_or(false) {
            return Err(error_messages::NOT_MEMBER.to_string());
        }

        let _ = channel_info.members.remove(&executor_id);
        let _ = self.channels.insert(channel.clone(), channel_info);

        app::emit!(Event::ChannelLeft(channel.name.clone()));

        Ok(format!("Left channel '{}' successfully", channel.name))
    }

    pub(crate) fn is_channel_member(&self, channel: &Channel, user_id: &UserId) -> bool {
        // OOP: Check membership directly from channel
        self.channels
            .get(channel)
            .ok()
            .flatten()
            .map(|channel_info| channel_info.members.contains(user_id).unwrap_or(false))
            .unwrap_or(false)
    }

    fn get_user_channel_unread_info(&self, user_id: &UserId, channel: &Channel) -> (u32, u64) {
        // OOP: Get unread info from channel's own tracking
        if let Ok(Some(channel_info)) = self.channels.get(channel) {
            if let Ok(Some(unread)) = channel_info.unread_tracking.get(user_id) {
                return (unread.unread_count, unread.last_read_timestamp);
            }
        }
        (0, 0)
    }

    fn get_user_channel_mention_count(&self, user_id: &UserId, channel: &Channel) -> u32 {
        // OOP: Get mention count from channel's own tracking
        if let Ok(Some(channel_info)) = self.channels.get(channel) {
            if let Ok(Some(mentions)) = channel_info.mentions_tracking.get(user_id) {
                return mentions.len().unwrap_or(0) as u32;
            }
        }
        0
    }

    // OOP: This is now handled directly in channel_info.mentions_tracking
    // Method kept for compatibility but now operates on the channel's own tracking
    pub(crate) fn initialize_mentions_tracking_for_user_in_channel(
        &mut self,
        user_id: &UserId,
        channel: &Channel,
    ) {
        if let Ok(Some(mut channel_info)) = self.channels.get(channel) {
            if channel_info.mentions_tracking.get(user_id).ok().flatten().is_none() {
                let _ = channel_info.mentions_tracking.insert(*user_id, Vector::new());
                let _ = self.channels.insert(channel.clone(), channel_info);
            }
        }
    }
}

