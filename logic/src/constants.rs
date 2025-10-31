//! Constants Module
//!
//! Centralized constants and error messages following DRY principle.

/// Maximum allowed length for usernames
pub const MAX_USERNAME_LENGTH: usize = 50;

/// Error Messages Module
///
/// Centralized error message constants following DRY and KISS principles.
///
/// Benefits:
/// - **Consistency**: Same error for same condition everywhere
/// - **Maintainability**: Change message in one place
/// - **Testability**: Easy to verify error conditions
/// - **I18n Ready**: Centralized for future internationalization
///
/// Categories:
/// - Membership errors (ALREADY_MEMBER, NOT_MEMBER, etc.)
/// - Channel errors (CHANNEL_NOT_FOUND, etc.)
/// - Permission errors (NO_DELETE_PERMISSION, etc.)
/// - DM errors (DM_ALREADY_EXISTS, CANNOT_DM_YOURSELF, etc.)
pub mod error_messages {
    pub const ALREADY_MEMBER: &str = "Already a member of the chat";
    pub const NOT_MEMBER: &str = "You are not a member of this channel";
    pub const CHANNEL_NOT_FOUND: &str = "Channel not found";
    pub const ALREADY_CHANNEL_MEMBER: &str = "Already a member of this channel";
    pub const USERNAME_EMPTY: &str = "Username cannot be empty";
    pub const USERNAME_TAKEN: &str = "Username is already taken";
    pub const THREAD_NOT_FOUND: &str = "Thread not found";
    pub const MESSAGE_NOT_FOUND: &str = "Message not found";
    pub const MESSAGE_NOT_FOUND_IN_THREAD: &str = "Message not found in thread";
    pub const ONLY_EDIT_OWN: &str = "You can only edit your own messages";
    pub const NO_DELETE_PERMISSION: &str = "You don't have permission to delete this message";
    pub const CANNOT_DM_YOURSELF: &str = "Cannot create DM with yourself";
    pub const DM_ALREADY_EXISTS: &str = "DM already exists";
    pub const DM_NOT_FOUND: &str = "DM does not exist";
    pub const USER_NOT_CHAT_MEMBER: &str = "User is not a member of the chat";
    pub const USER_ALREADY_CHANNEL_MEMBER: &str = "User is already a member of this channel";
    pub const ONLY_JOIN_PUBLIC: &str = "Can only join public channels";
    pub const CANNOT_LEAVE_DM: &str = "Cannot leave a DM chat";
    pub const CANNOT_INVITE_TO_DM: &str = "Cannot invite to a DM chat";
    pub const CANNOT_CREATE_CHANNEL_IN_DM: &str = "Cannot create channels in a DM chat";
}

