//! Tracking Management Implementation
//!
//! Handles unread message and mention tracking.

use calimero_sdk::app;
use crate::state::CurbChat;
use crate::models::message::UserId;
use crate::models::channel::Channel;
use crate::models::tracking::UserChannelUnread;
use crate::constants::error_messages;
use calimero_storage::collections::UnorderedMap;

#[app::logic]
impl CurbChat {
    pub fn mark_messages_as_read(
        &mut self,
        channel: Channel,
        timestamp: u64,
    ) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        let mut channel_info = self
            .channels
            .get(&channel)
            .map_err(|_| error_messages::CHANNEL_NOT_FOUND.to_string())?
            .ok_or_else(|| error_messages::CHANNEL_NOT_FOUND.to_string())?;

        // OOP: Update unread tracking directly in channel
        let channel_unread = UserChannelUnread {
            last_read_timestamp: timestamp,
            unread_count: 0,
        };
        let _ = channel_info.unread_tracking.insert(executor_id, channel_unread);

        // OOP: Clear mentions directly in channel
        let _ = channel_info.mentions_tracking.remove(&executor_id);
        
        let _ = self.channels.insert(channel, channel_info);

        Ok("Messages marked as read".to_string())
    }

    pub fn get_channel_unread_count(&self, channel: Channel) -> app::Result<u32, String> {
        let executor_id = self.get_executor_id();

        // OOP: Get unread count from channel's tracking
        if let Ok(Some(channel_info)) = self.channels.get(&channel) {
            if let Ok(Some(unread)) = channel_info.unread_tracking.get(&executor_id) {
                return Ok(unread.unread_count);
            }
        }

        Ok(0)
    }

    pub fn get_channel_last_read_timestamp(&self, channel: Channel) -> app::Result<u64, String> {
        let executor_id = self.get_executor_id();

        // OOP: Get last read timestamp from channel's tracking
        if let Ok(Some(channel_info)) = self.channels.get(&channel) {
            if let Ok(Some(unread)) = channel_info.unread_tracking.get(&executor_id) {
                return Ok(unread.last_read_timestamp);
            }
        }

        Ok(0)
    }

    pub fn get_total_unread_count(&self) -> app::Result<u32, String> {
        let executor_id = self.get_executor_id();

        // OOP: Iterate through all channels and sum unread from each channel's tracking
        let mut total = 0;
        if let Ok(entries) = self.channels.entries() {
            for (_, channel_info) in entries {
                if let Ok(Some(unread)) = channel_info.unread_tracking.get(&executor_id) {
                    total += unread.unread_count;
                }
            }
        }

        Ok(total)
    }

    pub fn get_channel_mention_count(&self, channel: Channel) -> app::Result<u32, String> {
        let executor_id = self.get_executor_id();

        // OOP: Get mention count from channel's tracking
        if let Ok(Some(channel_info)) = self.channels.get(&channel) {
            if let Ok(Some(mentions)) = channel_info.mentions_tracking.get(&executor_id) {
                return Ok(mentions.len().unwrap_or(0) as u32);
            }
        }

        Ok(0)
    }

    pub fn get_total_mention_count(&self) -> app::Result<u32, String> {
        let executor_id = self.get_executor_id();

        // OOP: Iterate through all channels and sum mentions from each channel's tracking
        let mut total = 0;
        if let Ok(entries) = self.channels.entries() {
            for (_, channel_info) in entries {
                if let Ok(Some(mentions)) = channel_info.mentions_tracking.get(&executor_id) {
                    total += mentions.len().unwrap_or(0) as u32;
                }
            }
        }

        Ok(total)
    }
}

