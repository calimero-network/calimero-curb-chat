//! DM (Direct Message) Models
//!
//! Contains direct message conversation data structures.

use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::serde::{Deserialize, Serialize};
use calimero_storage::collections::crdt_meta::{MergeError, Mergeable};
use crate::models::message::UserId;
use crate::models::channel::ChannelType;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct DMChatInfo {
    pub created_at: u64,
    pub context_id: String,
    pub channel_type: ChannelType,

    // inviter - old chat identity
    pub created_by: UserId,
    // own identity - new dm identity
    pub own_identity_old: UserId,
    pub own_identity: Option<UserId>,
    pub own_username: String,

    // other identity - new dm identity
    pub other_identity_old: UserId,
    pub other_identity_new: Option<UserId>,
    pub other_username: String,

    pub did_join: bool,
    pub invitation_payload: String,

    // Hash tracking for new message detection
    pub old_hash: String,
    pub new_hash: String,

    // Unread message count
    pub unread_messages: u32,
}

/// LSP: Mergeable implementation for DMChatInfo
///
/// **Contract**: Last-Write-Wins (LWW) based on created_at timestamp
/// **Invariant**: Later created_at always wins
/// **Substitutability**: Follows standard timestamp-based merge pattern
impl Mergeable for DMChatInfo {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        // LWW: Accept other if its created_at is greater or equal
        if other.created_at >= self.created_at {
            *self = other.clone();
        }
        Ok(())
    }
}

