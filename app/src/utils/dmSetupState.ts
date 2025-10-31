import type { ActiveChat } from "../types/Common";
import { DMSetupState } from "../types/Common";

// **
//  ------STEP 1-------
//  NODE1 - CREATOR
//  case0 - has account, no other new identity, no invitation payload, no can join
//  case0 - waiting for NODE2 to create identity
//
// NODE2 - INVITEE
// case0 - no has account, has other new identity, no invitation payload, can join
// case0 - prompt him to create identity popup
//
// ------STEP 2-------
// NODE1 - CREATOR
//  case1 - has account, has other new identity, no invitation payload, no can join
//  case1 - show him the invitation to context popup
//
// NODE2 - INVITEE
// case1 - has account, has other new identity, no invitation payload, can join
// case1 - show him waiting for invitation popup
//
// ------STEP 3-------
// NODE1 - CREATOR
//  case2 - has account, has other new identity, has invitation payload, no can join
//  case2 - Show him normal chat
//
// NODE2 - INVITEE
// **

export function getDMSetupState(activeChat: ActiveChat): DMSetupState {
  if (activeChat.type !== "direct_message") {
    return DMSetupState.ACTIVE;
  }

  const hasAccount = !!activeChat.account;
  const hasOtherIdentity = !!activeChat.otherIdentityNew;
  const hasInvitationPayload = !!activeChat.invitationPayload;
  const canJoin = activeChat.canJoin;
  const isSynced = activeChat.isSynced;
  const didJoin = activeChat.didJoin ?? false;

  // Context created but not yet synced: gate chat until sync completes.
  // This applies to both creator and invitee after join, regardless of invitation payload presence.
  if (!canJoin && !isSynced) {
    return DMSetupState.SYNC_WAITING;
  }

  // If invitee hasn't joined yet (did_join: false), show join popup
  // This check should come before other checks to ensure invitee sees join popup
  if (canJoin && hasInvitationPayload && !didJoin) {
    return DMSetupState.INVITEE_CONTEXT_ACCEPT_POPUP;
  }

  //NODE1 - CASE2 (Creator with invitation payload)
  if (hasAccount && hasInvitationPayload && !canJoin && didJoin) {
    return DMSetupState.ACTIVE;
  }

  // NODE2 - CASE2 (Invitee without account, but this should be handled by did_join check above)
  if (!hasAccount && hasOtherIdentity && hasInvitationPayload && canJoin) {
    return DMSetupState.INVITEE_CONTEXT_ACCEPT_POPUP;
  }

  // Default: show active chat only if user has joined
  if (didJoin) {
    return DMSetupState.ACTIVE;
  }

  // If user hasn't joined and has invitation, show join popup
  if (hasInvitationPayload && canJoin) {
    return DMSetupState.INVITEE_CONTEXT_ACCEPT_POPUP;
  }

  return DMSetupState.ACTIVE;
}

/**
 * Helper function to check if the current user is the creator of the DM
 */
export function isCreator(activeChat: ActiveChat): boolean {
  return !!activeChat.account && !activeChat.canJoin;
}

/**
 * Helper function to check if the current user is the invitee of the DM
 */
export function isInvitee(activeChat: ActiveChat): boolean {
  return activeChat.canJoin ?? false;
}

export function generateDMParams(
  value: string,
  creatorUsername: string,
  inviteeUsername: string,
) {
  const jsonData = {
    name: value,
    default_channels: [{ name: "private_dm" }],
    created_at: Date.now(),
    is_dm: true,
    invitee: value,
    owner_username: creatorUsername,
    invitee_username: inviteeUsername,
  };
  const jsonString = JSON.stringify(jsonData);
  return {
    applicationId: import.meta.env.VITE_APPLICATION_ID || "",
    protocol: "near",
    params: jsonString,
  };
}
