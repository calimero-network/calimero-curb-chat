//! Tracking Models
//!
//! Contains unread message and mention tracking data structures.

use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::serde::{Deserialize, Serialize};
use calimero_storage::collections::crdt_meta::{MergeError, Mergeable};
use crate::models::message::MessageId;

/// Tracks unread messages for a user in a specific channel
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct UserChannelUnread {
    /// Timestamp of the last message read by the user in this channel
    pub last_read_timestamp: u64,
    /// Number of unread messages for the user in this channel
    pub unread_count: u32,
}

/// LSP: Mergeable implementation for UserChannelUnread
///
/// **Contract**: Last-Write-Wins (LWW) based on last_read_timestamp
/// **Invariant**: Later read timestamp indicates more recent state
/// **Substitutability**: Consistent with timestamp-based merge semantics
impl Mergeable for UserChannelUnread {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        // LWW: Accept other if its last_read_timestamp is greater or equal
        if other.last_read_timestamp >= self.last_read_timestamp {
            *self = other.clone();
        }
        Ok(())
    }
}

/// Tracks mentions for a user in a specific channel
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct UserChannelMentions {
    /// Message ID that caused the mention
    pub message_id: MessageId,
    /// Total mention count for this message
    pub mention_count: u32,
    /// Types of mentions (@here, @everyone, @username)
    pub mention_types: Vec<String>,
    /// Timestamp when the mention occurred
    pub timestamp: u64,
}

impl AsRef<[u8]> for UserChannelMentions {
    fn as_ref(&self) -> &[u8] {
        self.message_id.as_bytes()
    }
}

/// LSP: Mergeable implementation for UserChannelMentions
///
/// **Contract**: Last-Write-Wins (LWW) based on timestamp
/// **Invariant**: Later timestamp wins, preserving most recent mention state
/// **Substitutability**: Follows consistent timestamp-based merge pattern
impl Mergeable for UserChannelMentions {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        // LWW: Accept other if its timestamp is greater or equal
        if other.timestamp >= self.timestamp {
            *self = other.clone();
        }
        Ok(())
    }
}

