//! Message Models
//!
//! Contains all message-related data structures.

use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::serde::{Deserialize, Serialize};
use calimero_storage::collections::{Vector, UnorderedMap, UnorderedSet, LwwRegister};
use calimero_storage::collections::crdt_meta::{Mergeable, MergeError};
use std::collections::HashMap;
use crate::types::id::Id;

pub type UserId = Id<32, 44>;
pub type MessageId = String;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct MessageSentEvent {
    pub message_id: String,
    pub channel: String,
}

/// Message using proper CRDT types
///
/// **CRDT Strategy**:
/// - Scalar fields use `LwwRegister<T>` for Last-Write-Wins semantics
/// - Collections use storage CRDTs (Vector, UnorderedMap, UnorderedSet) which auto-merge
/// - Manual Mergeable impl calls merge on each field
#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct Message {
    pub timestamp: LwwRegister<u64>,
    pub sender: LwwRegister<UserId>,
    pub sender_username: LwwRegister<String>,
    pub mentions: Vector<UserId>,          // ✅ UserId implements Mergeable  
    pub mentions_usernames: Vector<String>,  // ✅ String implements Mergeable
    pub id: LwwRegister<MessageId>,
    pub text: LwwRegister<String>,
    pub edited_on: LwwRegister<u64>,      // ✅ 0 = not edited
    pub deleted: LwwRegister<bool>,       // ✅ false = not deleted
    pub group: LwwRegister<String>,
    
    // OOP Encapsulation: Message owns its threads and reactions
    /// Thread replies to this message (nested messages)
    pub threads: Vector<Message>,
    /// Reactions on this message: reaction emoji -> list of usernames
    pub reactions: UnorderedMap<String, UnorderedSet<String>>,
}

impl Mergeable for Message {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        // Explicitly use Mergeable trait to avoid ambiguity with LwwRegister::merge()
        Mergeable::merge(&mut self.timestamp, &other.timestamp)?;
        Mergeable::merge(&mut self.sender, &other.sender)?;
        Mergeable::merge(&mut self.sender_username, &other.sender_username)?;
        Mergeable::merge(&mut self.mentions, &other.mentions)?;
        Mergeable::merge(&mut self.mentions_usernames, &other.mentions_usernames)?;
        Mergeable::merge(&mut self.id, &other.id)?;
        Mergeable::merge(&mut self.text, &other.text)?;
        Mergeable::merge(&mut self.edited_on, &other.edited_on)?;
        Mergeable::merge(&mut self.deleted, &other.deleted)?;
        Mergeable::merge(&mut self.group, &other.group)?;
        Mergeable::merge(&mut self.threads, &other.threads)?;
        Mergeable::merge(&mut self.reactions, &other.reactions)?;
        Ok(())
    }
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct MessageWithReactions {
    pub timestamp: u64,
    pub sender: UserId,
    pub sender_username: String,
    pub mentions: Vec<UserId>,
    pub mentions_usernames: Vec<String>,
    pub id: MessageId,
    pub text: String,
    pub edited_on: u64,                   // 0 = not edited
    pub reactions: Option<HashMap<String, Vec<String>>>,
    pub deleted: bool,                    // false = not deleted
    pub thread_count: u32,
    pub thread_last_timestamp: u64,
    pub group: String,
}

