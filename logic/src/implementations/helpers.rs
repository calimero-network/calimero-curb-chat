//! Helper Functions Implementation
//!
//! Core utilities and internal helper methods.

use calimero_sdk::{app, env};
use crate::state::CurbChat;
use crate::models::message::{Message, UserId};

#[app::logic]
impl CurbChat {
    pub(crate) fn get_executor_id(&self) -> UserId {
        UserId::new(env::executor_id())
    }

    pub fn get_username(&self, user_id: UserId) -> String {
        self.member_usernames
            .get(&user_id)
            .ok()
            .flatten()
            .unwrap_or_else(|| "Unknown".to_string())
    }

    pub(crate) fn can_delete_message(&self, message: &Message, user_id: &UserId) -> bool {
        // User can delete if they're the sender or a moderator
        // CRDT: Compare sender using .get()
        message.sender.get() == user_id || self.moderators.contains(user_id).unwrap_or(false)
    }
}

