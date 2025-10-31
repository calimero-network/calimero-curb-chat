//! Events Module
//!
//! Contains all event definitions for the chat application.

use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::serde::{Deserialize, Serialize};
use calimero_sdk::app;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct MessageSentEvent {
    pub message_id: String,
    pub channel: String,
}

#[app::event]
pub enum Event {
    ChatInitialized(String),
    ChatJoined(String),
    ChannelCreated(String),
    ChannelInvited(String),
    ChannelLeft(String),
    MessageSent(MessageSentEvent),
    MessageSentThread(MessageSentEvent),
    MessageReceived(String),
    ChannelJoined(String),
    DMCreated(String),
    ReactionUpdated(String),
    NewIdentityUpdated(String),
    InvitationPayloadUpdated(String),
    InvitationAccepted(String),
    DMDeleted(String),
}

