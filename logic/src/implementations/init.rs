//! Initialization Implementation
//!
//! Contains the init method and initialization helpers.

use calimero_sdk::{app, env};
use calimero_storage::collections::{UnorderedMap, UnorderedSet, Vector};
use crate::state::CurbChat;
use crate::models::message::{Message, MessageId, UserId};
use crate::models::channel::{Channel, ChannelInfo, ChannelType, ChannelMetadata};

#[app::logic]
impl CurbChat {
    #[app::init]
    pub fn init(
        name: String,
        default_channels: Vec<Channel>,
        created_at: u64,
        is_dm: bool,
        invitee: Option<UserId>,
        owner_username: Option<String>,
        invitee_username: Option<String>,
    ) -> CurbChat {
        let executor_id = UserId::new(env::executor_id());

        // Initialize members
        let (members, member_usernames) = Self::initialize_members(
            executor_id,
            is_dm,
            invitee,
            owner_username.clone(),
            invitee_username,
        );

        // Create default channels
        let (channels, moderators) = Self::create_default_channels(
            default_channels,
            executor_id,
            created_at,
            owner_username,
            is_dm,
            invitee,
        );

        CurbChat {
            owner: executor_id,
            name,
            created_at,
            is_dm,
            members,
            member_usernames,
            moderators,
            channels,
            dm_chats: UnorderedMap::new(),
        }
    }

    /// Initializes initial members for chat (owner and optionally invitee for DM)
    fn initialize_members(
        executor_id: UserId,
        is_dm: bool,
        invitee: Option<UserId>,
        owner_username: Option<String>,
        invitee_username: Option<String>,
    ) -> (UnorderedSet<UserId>, UnorderedMap<UserId, String>) {
        let mut members = UnorderedSet::new();
        let mut member_usernames = UnorderedMap::new();

        // Add owner
        let _ = members.insert(executor_id);
        if let Some(username) = owner_username {
            let _ = member_usernames.insert(executor_id, username);
        }

        // Add invitee for DM
        if is_dm {
            if let Some(invitee_id) = invitee {
                let _ = members.insert(invitee_id);
                if let Some(username) = invitee_username {
                    let _ = member_usernames.insert(invitee_id, username);
                }
            }
        }

        (members, member_usernames)
    }

    /// Creates default channels with their metadata and member lists
    fn create_default_channels(
        default_channels: Vec<Channel>,
        executor_id: UserId,
        created_at: u64,
        owner_username: Option<String>,
        is_dm: bool,
        invitee: Option<UserId>,
    ) -> (
        UnorderedMap<Channel, ChannelInfo>,
        UnorderedSet<UserId>,
    ) {
        let mut channels = UnorderedMap::new();
        let mut moderators = UnorderedSet::new();

        for channel in default_channels {
            // Create channel info
            let mut channel_info = ChannelInfo {
                messages: Vector::new(),
                channel_type: ChannelType::Default,
                read_only: false,
                meta: ChannelMetadata {
                    created_at,
                    created_by: executor_id,
                    created_by_username: owner_username.clone(),
                    read_only: UnorderedSet::new(),
                    moderators: UnorderedSet::new(),
                    links_allowed: true,
                },
                last_read: UnorderedMap::new(),
                // OOP: Initialize channel's own members and tracking
                members: UnorderedSet::new(),
                unread_tracking: UnorderedMap::new(),
                mentions_tracking: UnorderedMap::new(),
            };
            // OOP: Add initial members directly to the channel
            let _ = channel_info.members.insert(executor_id);
            if is_dm {
                if let Some(invitee_id) = &invitee {
                    let _ = channel_info.members.insert(invitee_id.clone());
                }
            }
            
            let _ = channels.insert(channel.clone(), channel_info);
        }

        let _ = moderators.insert(executor_id);

        (channels, moderators)
    }
}

