//! State Module
//!
//! Contains the main CurbChat state struct definition.

use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::app;
use calimero_storage::collections::{UnorderedMap, UnorderedSet, Vector};
use crate::models::message::{Message, MessageId, UserId};
use crate::models::channel::{Channel, ChannelInfo};
use crate::models::dm::DMChatInfo;
use crate::models::tracking::{UserChannelUnread, UserChannelMentions};
use crate::events::Event;

#[app::state(emits = Event)]
#[derive(BorshSerialize, BorshDeserialize)]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct CurbChat {
    // ============================================================================
    // CLEANED OOP STATE - Encapsulation following Single Responsibility
    // ============================================================================
    
    /// Global chat metadata
    pub(crate) owner: UserId,
    pub(crate) name: String,
    pub(crate) created_at: u64,
    pub(crate) is_dm: bool,
    
    /// Global members and their usernames
    pub(crate) members: UnorderedSet<UserId>,
    pub(crate) member_usernames: UnorderedMap<UserId, String>,
    pub(crate) moderators: UnorderedSet<UserId>,
    
    /// Channels - now OWN their members, messages (with threads & reactions), and tracking
    /// Access pattern: channels.get(channel).members instead of channel_members.get(channel)
    pub(crate) channels: UnorderedMap<Channel, ChannelInfo>,
    
    /// DM chats
    pub(crate) dm_chats: UnorderedMap<UserId, Vector<DMChatInfo>>,
    
    // ============================================================================
    // REMOVED (Now encapsulated in ChannelInfo and Message):
    // ============================================================================
    // ❌ threads: Now in Message.threads
    // ❌ reactions: Now in Message.reactions  
    // ❌ channel_members: Now in ChannelInfo.members
    // ❌ user_channel_unread: Now in ChannelInfo.unread_tracking
    // ❌ user_channel_mentions: Now in ChannelInfo.mentions_tracking
}

