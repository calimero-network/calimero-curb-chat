//! Channel Models
//!
//! Contains all channel-related data structures.

use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::serde::{Deserialize, Serialize};
use calimero_storage::collections::{UnorderedMap, UnorderedSet, Vector};
use calimero_storage::collections::crdt_meta::{MergeError, Mergeable};
use crate::models::message::{Message, MessageId, UserId};
use crate::models::tracking::{UserChannelUnread, UserChannelMentions};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub enum ChannelType {
    Public,
    Private,
    Default,
}

/// LSP: Mergeable implementation for ChannelType
///
/// **Contract**: Always accept other's value (unconditional overwrite)
/// **Invariant**: No timestamp check - assumes coordinated updates
/// **Substitutability**: Follows Mergeable contract correctly
impl Mergeable for ChannelType {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        // Unconditional accept: channel type is assumed coordinated
        *self = other.clone();
        Ok(())
    }
}

#[derive(
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Clone,
    Hash,
)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct Channel {
    pub name: String,
}

impl AsRef<[u8]> for Channel {
    fn as_ref(&self) -> &[u8] {
        self.name.as_bytes()
    }
}

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct ChannelMetadata {
    pub created_at: u64,
    pub created_by: UserId,
    pub created_by_username: Option<String>,
    pub read_only: UnorderedSet<UserId>,
    pub moderators: UnorderedSet<UserId>,
    pub links_allowed: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "calimero_sdk::serde")]
pub struct PublicChannelMetadata {
    pub created_at: u64,
    pub created_by: UserId,
    pub created_by_username: String,
    pub links_allowed: bool,
}

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct ChannelInfo {
    pub messages: Vector<Message>,
    pub channel_type: ChannelType,
    pub read_only: bool,
    pub meta: ChannelMetadata,
    pub last_read: UnorderedMap<UserId, MessageId>,
    
    // OOP Encapsulation: Channel owns its members and tracking data
    /// Members of this channel
    pub members: UnorderedSet<UserId>,
    /// Per-user unread tracking for this channel
    pub unread_tracking: UnorderedMap<UserId, UserChannelUnread>,
    /// Per-user mention tracking for this channel
    pub mentions_tracking: UnorderedMap<UserId, Vector<UserChannelMentions>>,
}

/// LSP: Mergeable implementation for ChannelInfo
///
/// **Contract**: Combines multiple merge strategies
/// **Invariants**:
///   - channel_type is immutable (not merged)
///   - Booleans are monotonic (once true, stays true)
///   - created_at uses LWW
///   - username prefers Some over None
/// **Substitutability**: Maintains all Mergeable guarantees
impl Mergeable for ChannelInfo {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        // Keep channel_type as-is (assumed immutable after creation)

        // Monotonic booleans: once set to true, cannot go back to false
        self.read_only |= other.read_only;
        self.meta.links_allowed |= other.meta.links_allowed;

        // LWW on created_at: later timestamp wins
        if other.meta.created_at > self.meta.created_at {
            self.meta.created_at = other.meta.created_at;
        }

        // Prefer Some username over None (fills in missing data)
        if self.meta.created_by_username.is_none() {
            self.meta.created_by_username = other.meta.created_by_username.clone();
        }

        Ok(())
    }
}

