//! Reaction Management Implementation
//!
//! Handles reaction operations: add/remove reactions.

use calimero_sdk::app;
use crate::state::CurbChat;
use crate::models::message::MessageId;
use crate::models::channel::Channel;
use crate::events::Event;
use calimero_storage::collections::UnorderedSet;

#[app::logic]
impl CurbChat {
    pub fn update_reaction(
        &mut self,
        message_id: MessageId,
        reaction: String,
    ) -> app::Result<String, String> {
        let executor_id = self.get_executor_id();
        let username = self.get_username(executor_id);

        // Collect update location to avoid borrow checker issues  
        let mut update_info: Option<(String, usize, Option<usize>, bool)> = None; // (channel_name, msg_idx, thread_idx, had_reaction)

        // OOP: Find message in channels
        // TODO: this has to be O(1) complexity, currently it is O(NM) I believe
        if let Ok(entries) = self.channels.entries() {
            for (channel, channel_info) in entries {
                let channel_name = channel.name.clone();
                // Check channel messages
                if let Ok(msg_iter) = channel_info.messages.iter() {
                    for (msg_idx, message) in msg_iter.enumerate() {
                        // CRDT: Compare using .get()
                        if message.id.get() == &message_id {
                            let had_reaction = message.reactions
                                .get(&reaction)
                                .ok()
                                .flatten()
                                .map(|users| users.contains(&username).unwrap_or(false))
                                .unwrap_or(false);
                            update_info = Some((channel_name.clone(), msg_idx, None, had_reaction));
                            break;
                        }

                        // Also check thread messages
                        if let Ok(thread_iter) = message.threads.iter() {
                            for (thread_idx, thread_msg) in thread_iter.enumerate() {
                                // CRDT: Compare using .get()
                                if thread_msg.id.get() == &message_id {
                                    let had_reaction = thread_msg.reactions
                                        .get(&reaction)
                                        .ok()
                                        .flatten()
                                    .map(|users| users.contains(&username).unwrap_or(false))
                                    .unwrap_or(false);
                                    update_info = Some((channel_name.clone(), msg_idx, Some(thread_idx), had_reaction));
                                    break;
                                }
                            }
                        }
                        if update_info.is_some() {
                            break;
                        }
                    }
                }
                if update_info.is_some() {
                    break;
                }
            }
        }

        // Apply the update
        if let Some((channel_name, msg_idx, thread_idx_opt, had_reaction)) = update_info {
            let channel = Channel { name: channel_name };
            let mut channel_info = self.channels.get(&channel).ok().flatten().unwrap();

            if let Some(thread_idx) = thread_idx_opt {
                // Update thread message reaction
                let mut parent_msg = channel_info.messages.get(msg_idx).ok().flatten().unwrap();
                let mut thread_msg = parent_msg.threads.get(thread_idx).ok().flatten().unwrap();
                
                let mut reaction_users = thread_msg.reactions
                    .get(&reaction)
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| UnorderedSet::new());

                if had_reaction {
                    let _ = reaction_users.remove(&username);
                } else {
                    let _ = reaction_users.insert(username);
                }

                let _ = thread_msg.reactions.insert(reaction, reaction_users);
                let _ = parent_msg.threads.update(thread_idx, thread_msg);
                let _ = channel_info.messages.update(msg_idx, parent_msg);
            } else {
                // Update channel message reaction
                let mut message = channel_info.messages.get(msg_idx).ok().flatten().unwrap();
                
                let mut reaction_users = message.reactions
                    .get(&reaction)
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| UnorderedSet::new());

                if had_reaction {
                    let _ = reaction_users.remove(&username);
                } else {
                    let _ = reaction_users.insert(username);
                }

                let _ = message.reactions.insert(reaction, reaction_users);
                let _ = channel_info.messages.update(msg_idx, message);
            }

            let _ = self.channels.insert(channel, channel_info);
            app::emit!(Event::ReactionUpdated(message_id));
            Ok("Reaction updated successfully".to_string())
        } else {
            Ok("Reaction updated successfully".to_string())
        }
    }
}
