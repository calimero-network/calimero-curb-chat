//! Data Models Module
//!
//! Contains all data structures and their implementations.
//! Organized by domain responsibility following SRP.

pub mod message;
pub mod channel;
pub mod dm;
pub mod tracking;
pub mod response;

// Re-export commonly used types
pub use message::{Message, MessageWithReactions, MessageId};
pub use channel::{Channel, ChannelInfo, ChannelType, ChannelMetadata, PublicChannelMetadata};
pub use dm::DMChatInfo;
pub use tracking::{UserChannelUnread, UserChannelMentions};
pub use response::{FullMessageResponse, PublicChannelInfo};

