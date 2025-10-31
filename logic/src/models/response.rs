//! Response Models
//!
//! Contains response and public-facing data structures.

use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::serde::{Deserialize, Serialize};
use crate::models::message::{MessageWithReactions, UserId};
use crate::models::channel::ChannelType;

#[derive(Serialize, Deserialize)]
#[serde(crate = "calimero_sdk::serde")]
pub struct FullMessageResponse {
    pub total_count: u32,
    pub messages: Vec<MessageWithReactions>,
    pub start_position: u32,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct PublicChannelInfo {
    pub channel_type: ChannelType,
    pub read_only: bool,
    pub created_at: u64,
    pub created_by_username: String,
    pub created_by: UserId,
    pub links_allowed: bool,
    pub unread_count: u32,
    pub last_read_timestamp: u64,
    pub unread_mention_count: u32,
}

