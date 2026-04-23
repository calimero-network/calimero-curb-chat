use calimero_sdk::borsh::{BorshDeserialize, BorshSerialize};
use calimero_sdk::serde::de::Error as SerdeDeError;
use calimero_sdk::serde::{Deserialize, Serialize};
use calimero_sdk::{app, env};
use calimero_storage::collections::crdt_meta::MergeError;
use calimero_storage::collections::{
    AuthoredMap, AuthoredVector, LwwRegister, Mergeable as MergeableTrait, UnorderedMap,
    UnorderedSet, Vector,
};
use types::id;
mod types;
use std::collections::HashMap;
use std::fmt::Write;

id::define!(pub UserId<32, 44>);
type MessageId = String;

const BLOB_ID_SIZE: usize = 32;
const BASE58_ENCODED_MAX_SIZE: usize = 44;

fn encode_blob_id_base58(blob_id_bytes: &[u8; BLOB_ID_SIZE]) -> String {
    let mut buf = [0u8; BASE58_ENCODED_MAX_SIZE];
    let len = bs58::encode(blob_id_bytes).onto(&mut buf[..]).unwrap();
    std::str::from_utf8(&buf[..len]).unwrap().to_owned()
}

fn parse_blob_id_base58(blob_id_str: &str) -> Result<[u8; BLOB_ID_SIZE], String> {
    match bs58::decode(blob_id_str).into_vec() {
        Ok(bytes) if bytes.len() == BLOB_ID_SIZE => {
            let mut blob_id = [0u8; BLOB_ID_SIZE];
            blob_id.copy_from_slice(&bytes);
            Ok(blob_id)
        }
        Ok(bytes) => Err(format!(
            "Invalid blob ID length: expected {} bytes, got {}",
            BLOB_ID_SIZE,
            bytes.len()
        )),
        Err(e) => Err(format!("Failed to decode blob ID '{blob_id_str}': {e}")),
    }
}

fn serialize_blob_id_bytes<S>(
    blob_id_bytes: &[u8; BLOB_ID_SIZE],
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: calimero_sdk::serde::Serializer,
{
    let safe_string = encode_blob_id_base58(blob_id_bytes);
    serializer.serialize_str(&safe_string)
}

fn deserialize_blob_id_bytes<'de, D>(deserializer: D) -> Result<[u8; BLOB_ID_SIZE], D::Error>
where
    D: calimero_sdk::serde::Deserializer<'de>,
{
    let blob_id_str = <String as calimero_sdk::serde::Deserialize>::deserialize(deserializer)?;
    match bs58::decode(&blob_id_str).into_vec() {
        Ok(bytes) if bytes.len() == BLOB_ID_SIZE => {
            let mut blob_id = [0u8; BLOB_ID_SIZE];
            blob_id.copy_from_slice(&bytes);
            Ok(blob_id)
        }
        Ok(bytes) => Err(SerdeDeError::custom(format!(
            "Invalid blob ID length: expected {} bytes, got {}",
            BLOB_ID_SIZE,
            bytes.len()
        ))),
        Err(e) => Err(SerdeDeError::custom(format!(
            "Failed to decode blob ID '{}': {}",
            blob_id_str, e
        ))),
    }
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct MessageSentEvent {
    pub message_id: String,
}

#[derive(Debug, Clone, BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[borsh(crate = "calimero_sdk::borsh")]
#[serde(crate = "calimero_sdk::serde")]
pub struct Attachment {
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    #[serde(
        serialize_with = "serialize_blob_id_bytes",
        deserialize_with = "deserialize_blob_id_bytes"
    )]
    pub blob_id: [u8; BLOB_ID_SIZE],
    pub uploaded_at: u64,
}

impl MergeableTrait for Attachment {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        if other.uploaded_at > self.uploaded_at {
            *self = other.clone();
        }
        Ok(())
    }
}

impl Attachment {
    fn to_public(&self) -> AttachmentPublic {
        AttachmentPublic {
            name: self.name.clone(),
            mime_type: self.mime_type.clone(),
            size: self.size,
            blob_id: encode_blob_id_base58(&self.blob_id),
            uploaded_at: self.uploaded_at,
        }
    }
}

#[derive(Debug, Clone, BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[borsh(crate = "calimero_sdk::borsh")]
#[serde(crate = "calimero_sdk::serde")]
pub struct AttachmentPublic {
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub blob_id: String,
    pub uploaded_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[borsh(crate = "calimero_sdk::borsh")]
#[serde(crate = "calimero_sdk::serde")]
pub struct AttachmentInput {
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub blob_id_str: String,
}

#[app::event]
pub enum Event {
    Initialized(),
    MessageSent(MessageSentEvent),
    MessageSentThread(MessageSentEvent),
    ReactionUpdated(String),
    ProfileUpdated(String),
    InfoUpdated(),
}

/// "channel" or "dm" — stored in app state so it's mutable (supports renames).
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[serde(crate = "calimero_sdk::serde")]
#[borsh(crate = "calimero_sdk::borsh")]
pub enum ContextType {
    Channel,
    Dm,
}

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct Message {
    pub timestamp: LwwRegister<u64>,
    pub sender: UserId,
    pub sender_username: LwwRegister<String>,
    pub mentions: UnorderedSet<UserId>,
    pub mentions_usernames: Vector<LwwRegister<String>>,
    pub files: Vector<Attachment>,
    pub images: Vector<Attachment>,
    pub id: LwwRegister<MessageId>,
    pub text: LwwRegister<String>,
    pub edited_on: Option<LwwRegister<u64>>,
    pub deleted: Option<LwwRegister<bool>>,
}

impl MergeableTrait for Message {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        MergeableTrait::merge(&mut self.timestamp, &other.timestamp)?;
        MergeableTrait::merge(&mut self.sender_username, &other.sender_username)?;
        MergeableTrait::merge(&mut self.id, &other.id)?;
        MergeableTrait::merge(&mut self.text, &other.text)?;
        MergeableTrait::merge(&mut self.mentions, &other.mentions)?;
        MergeableTrait::merge(&mut self.mentions_usernames, &other.mentions_usernames)?;
        MergeableTrait::merge(&mut self.files, &other.files)?;
        MergeableTrait::merge(&mut self.images, &other.images)?;
        if let Some(ref b) = other.edited_on {
            if let Some(ref mut a) = self.edited_on {
                MergeableTrait::merge(a, b)?;
            } else {
                self.edited_on = Some(b.clone());
            }
        }
        if let Some(ref b) = other.deleted {
            if let Some(ref mut a) = self.deleted {
                MergeableTrait::merge(a, b)?;
            } else {
                self.deleted = Some(b.clone());
            }
        }
        Ok(())
    }
}

impl Clone for Message {
    fn clone(&self) -> Self {
        Message {
            timestamp: self.timestamp.clone(),
            sender: self.sender,
            sender_username: self.sender_username.clone(),
            mentions: {
                let mut new_set = UnorderedSet::new();
                if let Ok(iter) = self.mentions.iter() {
                    for item in iter {
                        let _ = new_set.insert(item);
                    }
                }
                new_set
            },
            mentions_usernames: {
                let mut new_vec = Vector::new();
                if let Ok(iter) = self.mentions_usernames.iter() {
                    for item in iter {
                        let _ = new_vec.push(item.clone());
                    }
                }
                new_vec
            },
            files: {
                let mut new_vec = Vector::new();
                if let Ok(iter) = self.files.iter() {
                    for attachment in iter {
                        let _ = new_vec.push(attachment.clone());
                    }
                }
                new_vec
            },
            images: {
                let mut new_vec = Vector::new();
                if let Ok(iter) = self.images.iter() {
                    for attachment in iter {
                        let _ = new_vec.push(attachment.clone());
                    }
                }
                new_vec
            },
            id: self.id.clone(),
            text: self.text.clone(),
            edited_on: self.edited_on.clone(),
            deleted: self.deleted.clone(),
        }
    }
}

impl Serialize for Message {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: calimero_sdk::serde::Serializer,
    {
        use calimero_sdk::serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("Message", 11)?;
        state.serialize_field("timestamp", &*self.timestamp)?;
        state.serialize_field("sender", &self.sender)?;
        state.serialize_field("sender_username", self.sender_username.get())?;

        let mentions_vec: Vec<UserId> = if let Ok(iter) = self.mentions.iter() {
            iter.collect()
        } else {
            Vec::new()
        };
        state.serialize_field("mentions", &mentions_vec)?;

        let mentions_usernames_vec: Vec<String> = if let Ok(iter) = self.mentions_usernames.iter() {
            iter.map(|r| r.get().clone()).collect()
        } else {
            Vec::new()
        };
        state.serialize_field("mentions_usernames", &mentions_usernames_vec)?;
        let files_vec = attachments_vector_to_public(&self.files);
        state.serialize_field("files", &files_vec)?;
        let images_vec = attachments_vector_to_public(&self.images);
        state.serialize_field("images", &images_vec)?;

        state.serialize_field("id", self.id.get())?;
        state.serialize_field("text", self.text.get())?;
        state.serialize_field("edited_on", &self.edited_on.as_ref().map(|r| **r))?;
        state.serialize_field("deleted", &self.deleted.as_ref().map(|r| **r))?;
        state.end()
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
    pub files: Vec<AttachmentPublic>,
    pub images: Vec<AttachmentPublic>,
    pub id: MessageId,
    pub text: String,
    pub edited_on: Option<u64>,
    pub reactions: Option<HashMap<String, Vec<String>>>,
    pub deleted: Option<bool>,
    pub thread_count: u32,
    pub thread_last_timestamp: u64,
}

fn attachments_vector_to_public(vector: &Vector<Attachment>) -> Vec<AttachmentPublic> {
    let mut attachments = Vec::new();
    if let Ok(iter) = vector.iter() {
        for attachment in iter {
            attachments.push(attachment.to_public());
        }
    }
    attachments
}

fn attachment_inputs_to_vector(
    inputs: Option<Vec<AttachmentInput>>,
    context_id: &[u8; 32],
) -> Result<Vector<Attachment>, String> {
    let mut vector = Vector::new();

    if let Some(attachment_inputs) = inputs {
        for attachment_input in attachment_inputs {
            let blob_id = parse_blob_id_base58(&attachment_input.blob_id_str)?;

            if !env::blob_announce_to_context(&blob_id, context_id) {
                let context_b58 = encode_blob_id_base58(context_id);
                app::log!(
                    "Warning: failed to announce blob {} to context {}",
                    attachment_input.blob_id_str,
                    context_b58
                );
            }

            let attachment = Attachment {
                name: attachment_input.name,
                mime_type: attachment_input.mime_type,
                size: attachment_input.size,
                blob_id,
                uploaded_at: env::time_now(),
            };

            let _ = vector.push(attachment);
        }
    }

    Ok(vector)
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "calimero_sdk::serde")]
pub struct FullMessageResponse {
    pub total_count: u32,
    pub messages: Vec<MessageWithReactions>,
    pub start_position: u32,
}

/// Per-context metadata returned by `get_info`.
#[derive(Serialize, Deserialize)]
#[serde(crate = "calimero_sdk::serde")]
pub struct ContextInfo {
    pub name: String,
    pub context_type: ContextType,
    pub description: String,
    pub created_at: u64,
}

/// Per-context user profile returned by `get_profiles`.
#[derive(Serialize, Deserialize)]
#[serde(crate = "calimero_sdk::serde")]
pub struct UserProfile {
    pub identity: UserId,
    pub username: String,
    pub avatar: Option<String>,
}

/// Per-context profile stored in CRDT state.
#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct StoredProfile {
    pub username: LwwRegister<String>,
    pub avatar: Option<LwwRegister<String>>,
}

impl MergeableTrait for StoredProfile {
    fn merge(&mut self, other: &Self) -> Result<(), MergeError> {
        MergeableTrait::merge(&mut self.username, &other.username)?;
        if let (Some(ref mut a), Some(ref b)) = (&mut self.avatar, &other.avatar) {
            MergeableTrait::merge(a, b)?;
        } else if other.avatar.is_some() {
            self.avatar = other.avatar.clone();
        }
        Ok(())
    }
}

/// One context = one conversation (channel or DM).
/// Messages, threads, reactions, profiles, and metadata live here.
#[app::state(emits = Event)]
#[derive(BorshSerialize, BorshDeserialize)]
#[borsh(crate = "calimero_sdk::borsh")]
pub struct MeroChat {
    name: LwwRegister<String>,
    context_type: LwwRegister<ContextType>,
    description: LwwRegister<String>,
    created_at: LwwRegister<u64>,
    messages: AuthoredVector<Message>,
    threads: UnorderedMap<MessageId, AuthoredVector<Message>>,
    reactions: UnorderedMap<MessageId, UnorderedMap<String, UnorderedSet<String>>>,
    profiles: AuthoredMap<UserId, StoredProfile>,
}

#[app::logic]
impl MeroChat {
    #[app::init]
    pub fn init(
        name: String,
        context_type: ContextType,
        description: String,
        created_at: u64,
    ) -> MeroChat {
        app::emit!(Event::Initialized());

        MeroChat {
            name: LwwRegister::new(name),
            context_type: LwwRegister::new(context_type),
            description: LwwRegister::new(description),
            created_at: LwwRegister::new(created_at),
            messages: AuthoredVector::new(),
            threads: UnorderedMap::new(),
            reactions: UnorderedMap::new(),
            profiles: AuthoredMap::new(),
        }
    }

    pub fn get_info(&self) -> ContextInfo {
        ContextInfo {
            name: self.name.get().clone(),
            context_type: self.context_type.get().clone(),
            description: self.description.get().clone(),
            created_at: *self.created_at,
        }
    }

    pub fn update_info(
        &mut self,
        name: Option<String>,
        description: Option<String>,
    ) -> app::Result<String, String> {
        if let Some(n) = name {
            self.name.set(n);
        }
        if let Some(d) = description {
            self.description.set(d);
        }
        app::emit!(Event::InfoUpdated());
        Ok("Info updated".to_string())
    }

    pub fn set_profile(
        &mut self,
        username: String,
        avatar: Option<String>,
    ) -> app::Result<String, String> {
        if username.trim().is_empty() {
            return Err("Username cannot be empty".to_string());
        }
        if username.len() > 50 {
            return Err("Username cannot be longer than 50 characters".to_string());
        }

        let executor_id = Self::executor_id();

        let profile = StoredProfile {
            username: LwwRegister::new(username),
            avatar: avatar.map(LwwRegister::new),
        };
        if self.profiles.contains(&executor_id).unwrap_or(false) {
            let _ = self.profiles.update(&executor_id, profile);
        } else {
            let _ = self.profiles.insert(executor_id, profile);
        }

        app::emit!(Event::ProfileUpdated(executor_id.to_string()));
        Ok("Profile set".to_string())
    }

    pub fn get_profiles(&self) -> Vec<UserProfile> {
        let mut result = Vec::new();
        if let Ok(entries) = self.profiles.entries() {
            for (user_id, profile) in entries {
                result.push(UserProfile {
                    identity: user_id,
                    username: profile.username.get().clone(),
                    avatar: profile.avatar.as_ref().map(|a| a.get().clone()),
                });
            }
        }
        result
    }

    fn executor_id() -> UserId {
        UserId::new(env::executor_id())
    }

    fn get_message_id(
        &self,
        account: &UserId,
        message: &str,
        timestamp: u64,
    ) -> MessageId {
        let mut hash_input = Vec::new();
        hash_input.extend_from_slice(account.as_ref());
        hash_input.extend_from_slice(message.as_bytes());
        hash_input.extend_from_slice(&timestamp.to_be_bytes());

        let message_counter = self.messages.len().unwrap_or(0) as u64 + 1;
        hash_input.extend_from_slice(&message_counter.to_be_bytes());

        let mut s = MessageId::with_capacity(hash_input.len() * 2);
        for &b in &hash_input {
            write!(&mut s, "{:02x}", b).unwrap();
        }
        format!("{}_{}", s, timestamp)
    }

    fn message_matches_search(message: &Message, search_term: Option<&str>) -> bool {
        match search_term {
            Some(term) => {
                let message_text = message.text.get();
                if message_text.to_lowercase().contains(term) {
                    return true;
                }
                message.sender_username.get().to_lowercase().contains(term)
            }
            None => true,
        }
    }

    pub fn send_message(
        &mut self,
        message: String,
        mentions: Vec<UserId>,
        mentions_usernames: Vec<String>,
        parent_message: Option<MessageId>,
        timestamp: u64,
        sender_username: String,
        files: Option<Vec<AttachmentInput>>,
        images: Option<Vec<AttachmentInput>>,
    ) -> app::Result<Message, String> {
        let executor_id = Self::executor_id();

        let sender_username = match self.profiles.get(&executor_id) {
            Ok(Some(profile)) => profile.username.get().clone(),
            _ => sender_username,
        };

        let message_id = self.get_message_id(&executor_id, &message, timestamp);
        let current_context = env::context_id();

        let files_vector = attachment_inputs_to_vector(files, &current_context)?;
        let images_vector = attachment_inputs_to_vector(images, &current_context)?;

        let mut mentions_set = UnorderedSet::new();
        for m in &mentions {
            let _ = mentions_set.insert(*m);
        }
        let mut mentions_usernames_vec = Vector::new();
        for m in &mentions_usernames {
            let _ = mentions_usernames_vec.push(LwwRegister::new(m.clone()));
        }

        let msg = Message {
            timestamp: LwwRegister::new(timestamp),
            sender: executor_id,
            sender_username: LwwRegister::new(sender_username),
            mentions: mentions_set,
            mentions_usernames: mentions_usernames_vec,
            files: files_vector,
            images: images_vector,
            id: LwwRegister::new(message_id.clone()),
            text: LwwRegister::new(message),
            deleted: None,
            edited_on: None,
        };

        if let Some(parent_id) = parent_message {
            let mut thread_messages = match self.threads.get(&parent_id) {
                Ok(Some(messages)) => messages,
                _ => AuthoredVector::new(),
            };
            let _ = thread_messages.push(msg.clone());
            let _ = self.threads.insert(parent_id, thread_messages);

            app::emit!(Event::MessageSentThread(MessageSentEvent {
                message_id: message_id.clone(),
            }));
        } else {
            let _ = self.messages.push(msg.clone());

            app::emit!(Event::MessageSent(MessageSentEvent {
                message_id: message_id.clone(),
            }));
        }

        Ok(msg)
    }

    pub fn get_messages(
        &self,
        parent_message: Option<MessageId>,
        limit: Option<usize>,
        offset: Option<usize>,
        search_term: Option<String>,
    ) -> app::Result<FullMessageResponse, String> {
        let normalized_search = search_term.map(|term| term.to_lowercase());

        if let Some(parent_id) = parent_message {
            let thread_messages = match self.threads.get(&parent_id) {
                Ok(Some(messages)) => messages,
                _ => {
                    return Ok(FullMessageResponse {
                        total_count: 0,
                        messages: Vec::new(),
                        start_position: 0,
                    })
                }
            };

            let filtered = self.collect_messages_with_reactions(
                &thread_messages,
                normalized_search.as_deref(),
                false,
            );
            return Ok(Self::paginate(filtered, limit, offset));
        }

        let filtered = self.collect_messages_with_reactions(
            &self.messages,
            normalized_search.as_deref(),
            true,
        );
        Ok(Self::paginate(filtered, limit, offset))
    }

    fn collect_messages_with_reactions(
        &self,
        messages: &AuthoredVector<Message>,
        search_term: Option<&str>,
        include_threads: bool,
    ) -> Vec<MessageWithReactions> {
        let mut result = Vec::new();
        if let Ok(iter) = messages.iter() {
            for message in iter {
                if !Self::message_matches_search(&message, search_term) {
                    continue;
                }

                let reactions = self.get_reactions_for_message(message.id.get());

                let (thread_count, thread_last_timestamp) = if include_threads {
                    self.get_thread_info(message.id.get())
                } else {
                    (0, 0)
                };

                let mentions_vec: Vec<UserId> = if let Ok(iter) = message.mentions.iter() {
                    iter.collect()
                } else {
                    Vec::new()
                };
                let mentions_usernames_vec: Vec<String> =
                    if let Ok(iter) = message.mentions_usernames.iter() {
                        iter.map(|r| r.get().clone()).collect()
                    } else {
                        Vec::new()
                    };

                result.push(MessageWithReactions {
                    timestamp: *message.timestamp,
                    sender: message.sender,
                    sender_username: message.sender_username.get().clone(),
                    id: message.id.get().clone(),
                    text: message.text.get().clone(),
                    mentions: mentions_vec,
                    mentions_usernames: mentions_usernames_vec,
                    files: attachments_vector_to_public(&message.files),
                    images: attachments_vector_to_public(&message.images),
                    reactions,
                    deleted: message.deleted.as_ref().map(|r| **r),
                    edited_on: message.edited_on.as_ref().map(|r| **r),
                    thread_count,
                    thread_last_timestamp,
                });
            }
        }
        result
    }

    fn get_reactions_for_message(
        &self,
        message_id: &str,
    ) -> Option<HashMap<String, Vec<String>>> {
        match self.reactions.get(message_id) {
            Ok(Some(reactions)) => {
                let mut hashmap = HashMap::new();
                if let Ok(entries) = reactions.entries() {
                    for (emoji, users) in entries {
                        let mut user_vec = Vec::new();
                        if let Ok(iter) = users.iter() {
                            for user in iter {
                                user_vec.push(user.clone());
                            }
                        }
                        hashmap.insert(emoji, user_vec);
                    }
                }
                Some(hashmap)
            }
            _ => None,
        }
    }

    fn get_thread_info(&self, message_id: &str) -> (u32, u64) {
        match self.threads.get(message_id) {
            Ok(Some(thread)) => {
                let count = thread.len().unwrap_or(0);
                let last_ts = if count > 0 {
                    thread
                        .get(count - 1)
                        .ok()
                        .flatten()
                        .map(|m| *m.timestamp)
                        .unwrap_or(0)
                } else {
                    0
                };
                (count as u32, last_ts)
            }
            _ => (0, 0),
        }
    }

    fn paginate(
        filtered: Vec<MessageWithReactions>,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> FullMessageResponse {
        let total = filtered.len();
        if total == 0 {
            return FullMessageResponse {
                total_count: 0,
                messages: Vec::new(),
                start_position: 0,
            };
        }

        let limit_value = limit.unwrap_or(total);
        let offset_value = offset.unwrap_or(0);

        if offset_value >= total {
            return FullMessageResponse {
                total_count: total as u32,
                messages: Vec::new(),
                start_position: offset_value as u32,
            };
        }

        let end_idx = total - offset_value;
        let start_idx = end_idx.saturating_sub(limit_value);
        let paginated = filtered[start_idx..end_idx].to_vec();

        FullMessageResponse {
            total_count: total as u32,
            messages: paginated,
            start_position: offset_value as u32,
        }
    }

    pub fn update_reaction(
        &mut self,
        message_id: MessageId,
        emoji: String,
        user: String,
        add: bool,
    ) -> app::Result<String, String> {
        let mut reactions = match self.reactions.get(&message_id) {
            Ok(Some(reactions)) => reactions,
            _ => UnorderedMap::new(),
        };

        let mut emoji_reactions = match reactions.get(&emoji) {
            Ok(Some(users)) => users,
            _ => UnorderedSet::new(),
        };

        if add {
            let _ = emoji_reactions.insert(user);
        } else {
            let _ = emoji_reactions.remove(&user);
        }

        let _ = reactions.insert(emoji, emoji_reactions);
        let _ = self.reactions.insert(message_id.clone(), reactions);

        let action = if add { "added" } else { "removed" };
        app::emit!(Event::ReactionUpdated(message_id.to_string()));
        Ok(format!("Reaction {} successfully", action))
    }

    pub fn edit_message(
        &mut self,
        message_id: MessageId,
        new_message: String,
        timestamp: u64,
        parent_id: Option<MessageId>,
    ) -> app::Result<Message, String> {
        let executor_id = Self::executor_id();

        if let Some(parent_message_id) = parent_id {
            let mut thread_messages = match self.threads.get(&parent_message_id) {
                Ok(Some(messages)) => messages,
                _ => return Err("Thread not found".to_string()),
            };

            let updated = Self::find_and_edit(
                &mut thread_messages,
                &message_id,
                &new_message,
                timestamp,
                &executor_id,
            )?;

            let _ = self.threads.insert(parent_message_id, thread_messages);

            app::emit!(Event::MessageSentThread(MessageSentEvent {
                message_id: updated.id.get().clone(),
            }));
            Ok(updated)
        } else {
            let updated = Self::find_and_edit(
                &mut self.messages,
                &message_id,
                &new_message,
                timestamp,
                &executor_id,
            )?;

            app::emit!(Event::MessageSent(MessageSentEvent {
                message_id: updated.id.get().clone(),
            }));
            Ok(updated)
        }
    }

    fn find_and_edit(
        messages: &mut AuthoredVector<Message>,
        message_id: &str,
        new_text: &str,
        timestamp: u64,
        executor_id: &UserId,
    ) -> Result<Message, String> {
        let mut target_index: Option<usize> = None;

        if let Ok(iter) = messages.iter() {
            for (index, message) in iter.enumerate() {
                if *message.id == *message_id {
                    if message.sender != *executor_id {
                        return Err("You can only edit your own messages".to_string());
                    }
                    target_index = Some(index);
                    break;
                }
            }
        }

        let index = target_index.ok_or_else(|| "Message not found".to_string())?;

        let original = messages
            .get(index)
            .map_err(|_| "Failed to read message".to_string())?
            .ok_or_else(|| "Message not found".to_string())?;

        let mut updated = original.clone();
        updated.text.set(new_text.to_string());
        updated.edited_on = Some(LwwRegister::new(timestamp));

        let _ = messages.update(index, updated.clone());
        Ok(updated)
    }

    pub fn delete_message(
        &mut self,
        message_id: MessageId,
        parent_id: Option<MessageId>,
    ) -> app::Result<String, String> {
        let executor_id = Self::executor_id();

        if let Some(parent_message_id) = parent_id {
            let mut thread_messages = match self.threads.get(&parent_message_id) {
                Ok(Some(messages)) => messages,
                _ => return Err("Thread not found".to_string()),
            };

            Self::find_and_delete(&mut thread_messages, &message_id, &executor_id)?;
            let _ = self.reactions.remove(&message_id);
            let _ = self.threads.insert(parent_message_id, thread_messages);

            app::emit!(Event::MessageSentThread(MessageSentEvent {
                message_id: message_id.clone(),
            }));
            Ok("Thread message deleted successfully".to_string())
        } else {
            Self::find_and_delete(&mut self.messages, &message_id, &executor_id)?;
            let _ = self.reactions.remove(&message_id);

            app::emit!(Event::MessageSent(MessageSentEvent {
                message_id: message_id.clone(),
            }));
            Ok("Message deleted successfully".to_string())
        }
    }

    fn find_and_delete(
        messages: &mut AuthoredVector<Message>,
        message_id: &str,
        executor_id: &UserId,
    ) -> Result<(), String> {
        let mut target_index: Option<usize> = None;

        if let Ok(iter) = messages.iter() {
            for (index, message) in iter.enumerate() {
                if *message.id == *message_id {
                    if message.sender != *executor_id {
                        return Err("You don't have permission to delete this message".to_string());
                    }
                    target_index = Some(index);
                    break;
                }
            }
        }

        let index = target_index.ok_or_else(|| "Message not found".to_string())?;

        let original = messages
            .get(index)
            .map_err(|_| "Failed to read message".to_string())?
            .ok_or_else(|| "Message not found".to_string())?;

        let mut deleted = original.clone();
        deleted.text.set(String::new());
        deleted.deleted = Some(LwwRegister::new(true));

        let _ = messages.update(index, deleted);
        Ok(())
    }
}
