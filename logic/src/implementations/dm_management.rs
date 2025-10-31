//! DM (Direct Message) Management Implementation
//!
//! Handles DM operations: create, list, update identity, delete.

use calimero_sdk::app;
use crate::state::CurbChat;
use crate::models::message::UserId;
use crate::models::dm::DMChatInfo;
use crate::models::channel::ChannelType;
use crate::constants::error_messages;
use crate::events::Event;
use calimero_storage::collections::Vector;

#[app::logic]
impl CurbChat {
    pub fn create_dm_chat(
        &mut self,
        other_user: UserId,
        context_id: String,
        invitation_payload: String,
        created_at: u64,
    ) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        if executor_id == other_user {
            return Err(error_messages::CANNOT_DM_YOURSELF.to_string());
        }

        let mut dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .unwrap_or_else(|| Vector::new());

        // Check if DM already exists
        if let Ok(iter) = dms.iter() {
            for dm in iter {
                if dm.other_identity_old == other_user
                    || dm.other_identity_new.as_ref() == Some(&other_user)
                {
                    return Err(error_messages::DM_ALREADY_EXISTS.to_string());
                }
            }
        }

        let own_username = self.get_username(executor_id);
        let other_username = self.get_username(other_user);

        let dm_info = DMChatInfo {
            created_at,
            context_id: context_id.clone(),
            channel_type: ChannelType::Private,
            created_by: executor_id,
            own_identity_old: executor_id,
            own_identity: Some(executor_id),
            own_username,
            other_identity_old: other_user,
            other_identity_new: Some(other_user),
            other_username,
            did_join: false,
            invitation_payload,
            old_hash: String::new(),
            new_hash: String::new(),
            unread_messages: 0,
        };

        let _ = dms.push(dm_info);
        let _ = self.dm_chats.insert(executor_id, dms);

        app::emit!(Event::DMCreated(context_id));

        Ok("DM chat created successfully".to_string())
    }

    pub fn update_new_identity(
        &mut self,
        old_identity: UserId,
        new_identity: UserId,
    ) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        let mut dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .ok_or_else(|| error_messages::DM_NOT_FOUND.to_string())?;

        // Collect update to apply after iteration
        let mut update_index: Option<(usize, DMChatInfo)> = None;
        if let Ok(iter) = dms.iter() {
            for (index, mut dm) in iter.enumerate() {
                if dm.other_identity_old == old_identity {
                    dm.other_identity_new = Some(new_identity);
                    update_index = Some((index, dm));
                    break;
                }
            }
        }

        if let Some((index, dm)) = update_index {
            let _ = dms.update(index, dm);
            let _ = self.dm_chats.insert(executor_id, dms);
        } else {
            return Err(error_messages::DM_NOT_FOUND.to_string());
        }

        app::emit!(Event::NewIdentityUpdated(new_identity.to_string()));

        Ok("Identity updated successfully".to_string())
    }

    pub fn get_dms(&self) -> app::Result<Vec<DMChatInfo>, String> {
        let executor_id = self.get_executor_id();

        let dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .unwrap_or_else(|| Vector::new());

        let mut result = Vec::new();
        if let Ok(iter) = dms.iter() {
            for dm in iter {
                result.push(dm);
            }
        }

        Ok(result)
    }

    pub fn get_dm_identity_by_context(&self, context_id: String) -> app::Result<UserId, String> {
        let executor_id = self.get_executor_id();

        let dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .ok_or_else(|| error_messages::DM_NOT_FOUND.to_string())?;

        if let Ok(iter) = dms.iter() {
            for dm in iter {
                if dm.context_id == context_id {
                    return Ok(dm.other_identity_new
                        .unwrap_or(dm.other_identity_old));
                }
            }
        }

        Err(error_messages::DM_NOT_FOUND.to_string())
    }

    pub fn delete_dm(&mut self, other_user: UserId) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        let mut dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .ok_or_else(|| error_messages::DM_NOT_FOUND.to_string())?;

        let mut found_index = None;
        if let Ok(iter) = dms.iter() {
            for (index, dm) in iter.enumerate() {
                if dm.other_identity_old == other_user
                    || dm.other_identity_new.as_ref() == Some(&other_user)
                {
                    found_index = Some(index);
                    break;
                }
            }
        }

        if let Some(index) = found_index {
            // Create a new vector without the deleted item
            let mut new_dms = Vector::new();
            if let Ok(iter) = dms.iter() {
                for (i, dm) in iter.enumerate() {
                    if i != index {
                        let _ = new_dms.push(dm);
                    }
                }
            }
            let _ = self.dm_chats.insert(executor_id, new_dms);

            app::emit!(Event::DMDeleted(other_user.to_string()));

            Ok("DM deleted successfully".to_string())
        } else {
            Err(error_messages::DM_NOT_FOUND.to_string())
        }
    }

    pub fn update_dm_hashes(&mut self, sender_id: UserId, other_user_id: UserId, new_hash: &str) {
        if let Ok(Some(dms)) = self.dm_chats.get(&sender_id) {
            // Collect update to apply after iteration
            let mut update_info: Option<(usize, DMChatInfo)> = None;
            if let Ok(iter) = dms.iter() {
                for (index, mut dm) in iter.enumerate() {
                    if dm.other_identity_old == other_user_id
                        || dm.other_identity_new.as_ref() == Some(&other_user_id)
                    {
                        dm.old_hash = dm.new_hash.clone();
                        dm.new_hash = new_hash.to_string();
                        update_info = Some((index, dm));
                        break;
                    }
                }
            }

            if let Some((index, dm)) = update_info {
                let mut dms_mut = dms;
                let _ = dms_mut.update(index, dm);
                let _ = self.dm_chats.insert(sender_id, dms_mut);
            }
        }
    }

    pub fn dm_has_new_messages(&self, user_id: UserId, other_user_id: UserId) -> bool {
        if let Ok(Some(dms)) = self.dm_chats.get(&user_id) {
            if let Ok(iter) = dms.iter() {
                for dm in iter {
                    if dm.other_identity_old == other_user_id
                        || dm.other_identity_new.as_ref() == Some(&other_user_id)
                    {
                        return dm.old_hash != dm.new_hash;
                    }
                }
            }
        }
        false
    }

    pub fn get_dm_with_status(
        &self,
        user_id: UserId,
        other_user_id: UserId,
    ) -> app::Result<DMChatInfo, String> {
        let dms = self
            .dm_chats
            .get(&user_id)
            .ok()
            .flatten()
            .ok_or_else(|| error_messages::DM_NOT_FOUND.to_string())?;

        if let Ok(iter) = dms.iter() {
            for dm in iter {
                if dm.other_identity_old == other_user_id
                    || dm.other_identity_new.as_ref() == Some(&other_user_id)
                {
                    return Ok(dm);
                }
            }
        }

        Err(error_messages::DM_NOT_FOUND.to_string())
    }

    pub fn mark_dm_as_read(&mut self, other_user_id: UserId) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        let mut dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .ok_or_else(|| error_messages::DM_NOT_FOUND.to_string())?;

        // Collect update to apply after iteration
        let mut update_info: Option<(usize, DMChatInfo)> = None;
        if let Ok(iter) = dms.iter() {
            for (index, mut dm) in iter.enumerate() {
                if dm.other_identity_old == other_user_id
                    || dm.other_identity_new.as_ref() == Some(&other_user_id)
                {
                    dm.unread_messages = 0;
                    dm.old_hash = dm.new_hash.clone();
                    update_info = Some((index, dm));
                    break;
                }
            }
        }

        if let Some((index, dm)) = update_info {
            let _ = dms.update(index, dm);
            let _ = self.dm_chats.insert(executor_id, dms);
        } else {
            return Err(error_messages::DM_NOT_FOUND.to_string());
        }

        Ok("DM marked as read".to_string())
    }

    pub fn get_dm_unread_count(&self, other_user_id: UserId) -> app::Result<u32, String> {
        let executor_id = self.get_executor_id();

        let dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .ok_or_else(|| error_messages::DM_NOT_FOUND.to_string())?;

        if let Ok(iter) = dms.iter() {
            for dm in iter {
                if dm.other_identity_old == other_user_id
                    || dm.other_identity_new.as_ref() == Some(&other_user_id)
                {
                    return Ok(dm.unread_messages);
                }
            }
        }

        Ok(0)
    }

    pub fn get_total_dm_unread_count(&self) -> app::Result<u32, String> {
        let executor_id = self.get_executor_id();

        let dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .unwrap_or_else(|| Vector::new());

        let mut total = 0;
        if let Ok(iter) = dms.iter() {
            for dm in iter {
                total += dm.unread_messages;
            }
        }

        Ok(total)
    }

    pub fn mark_all_dms_as_read(&mut self) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();

        let mut dms = self
            .dm_chats
            .get(&executor_id)
            .ok()
            .flatten()
            .unwrap_or_else(|| Vector::new());

        // Collect all updates to apply after iteration
        let mut updates: Vec<(usize, DMChatInfo)> = Vec::new();
        if let Ok(iter) = dms.iter() {
            for (index, mut dm) in iter.enumerate() {
                dm.unread_messages = 0;
                dm.old_hash = dm.new_hash.clone();
                updates.push((index, dm));
            }
        }

        // Apply all updates
        for (index, dm) in updates {
            let _ = dms.update(index, dm);
        }

        let _ = self.dm_chats.insert(executor_id, dms);

        Ok("All DMs marked as read".to_string())
    }
}

