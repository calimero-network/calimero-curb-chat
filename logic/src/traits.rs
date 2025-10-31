//! Traits Module
//!
//! Interface Segregation Principle (ISP) - Focused trait definitions.

use calimero_sdk::app;
use crate::models::message::{Message, MessageId, UserId, MessageWithReactions};
use crate::models::channel::{Channel, ChannelInfo};
use crate::models::response::FullMessageResponse;
use crate::events::MessageSentEvent;

/// Validator trait - Provides validation capabilities
/// 
/// ISP Principle: Segregates validation logic into a focused interface
/// so clients only depend on the validation methods they need.
pub trait Validator {
    fn validate_username(&self, username: &str, is_dm: bool) -> Result<(), String>;
    fn check_username_uniqueness(&self, username: &str) -> Result<(), String>;
    fn validate_channel_membership(&self, channel: &Channel, user_id: &UserId) -> Result<(), String>;
    fn can_delete_message(&self, message: &Message, user_id: &UserId) -> bool;
}

/// Paginator trait - Provides pagination capabilities
///
/// ISP Principle: Clients needing pagination don't need other unrelated functionality
pub trait Paginator {
    fn calculate_pagination_bounds(total_len: usize, limit: usize, offset: usize) -> Option<(usize, usize)>;
    fn get_thread_messages_paginated(
        &self,
        parent_id: &MessageId,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> app::Result<FullMessageResponse, String>;
    fn get_channel_messages_paginated(
        &self,
        channel_info: &ChannelInfo,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> FullMessageResponse;
}

/// ResponseBuilder trait - Provides response building capabilities
///
/// ISP Principle: Separates response construction from business logic
pub trait ResponseBuilder {
    fn empty_message_response() -> FullMessageResponse;
    fn build_message_response(total: u32, messages: Vec<MessageWithReactions>, offset: u32) -> FullMessageResponse;
}

/// EventEmitter trait - Provides event emission capabilities
///
/// ISP Principle: Event emission is separate from core business logic
pub trait EventEmitter {
    fn emit_message_event(&self, message_id: &MessageId, channel_name: &str, is_thread: bool);
}

