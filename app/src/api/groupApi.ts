import type { ApiResponse } from "@calimero-network/calimero-client";

export type VisibilityMode = "open" | "restricted";
export type GroupMemberRole = "Admin" | "Member";
export type UpgradePolicy =
  | "Automatic"
  | "LazyOnAccess"
  | { Coordinated: { deadline: number } };

export interface CreateGroupRequest {
  applicationId: string;
  upgradePolicy: UpgradePolicy;
}

export interface CreateGroupResponse {
  groupId: string;
}

export interface GroupInvitationFromAdmin {
  inviter_identity: string;
  group_id: string;
  expiration_height: number;
  secret_salt: number[];
  protocol: string;
  network: string;
  contract_id: string;
}

export interface SignedGroupOpenInvitation {
  invitation: GroupInvitationFromAdmin;
  inviter_signature: string;
}

export interface GroupInfo {
  groupId: string;
  appKey: string;
  targetApplicationId: string;
  upgradePolicy: UpgradePolicy;
  memberCount: number;
  contextCount: number;
  activeUpgrade: GroupUpgradeStatus | null;
  defaultCapabilities: number;
  defaultVisibility: VisibilityMode;
}

export interface GroupSummary {
  groupId: string;
  appKey: string;
  targetApplicationId: string;
  upgradePolicy: UpgradePolicy;
  createdAt: number;
}

export interface GroupMember {
  identity: string;
  role: GroupMemberRole;
}

export interface GroupUpgradeStatus {
  fromVersion: string;
  toVersion: string;
  initiatedAt: number;
  initiatedBy: string;
  status: string;
  total: number | null;
  completed: number | null;
  failed: number | null;
  completedAt: number | null;
}

export interface CreateInvitationRequest {
  requester?: string;
  expirationBlockHeight?: number;
}

export interface CreateInvitationResponse {
  invitation: SignedGroupOpenInvitation;
}

export interface JoinGroupRequest {
  invitation: SignedGroupOpenInvitation;
}

export interface JoinGroupResponse {
  groupId: string;
  memberIdentity: string;
}

export interface JoinGroupContextRequest {
  contextId: string;
}

export interface JoinGroupContextResponse {
  contextId: string;
  memberPublicKey: string;
}

export interface SyncGroupResponse {
  groupId: string;
  appKey: string;
  targetApplicationId: string;
  memberCount: number;
  contextCount: number;
}

export interface ContextVisibility {
  mode: VisibilityMode;
  creator: string;
}

export interface RemoveMemberRequest {
  members: string[];
}

export interface ManageAllowlistRequest {
  add?: string[];
  remove?: string[];
}

export interface SetMemberCapabilitiesRequest {
  capabilities: number;
}

export interface MemberCapabilities {
  capabilities: number;
}

export interface SetDefaultCapabilitiesRequest {
  defaultCapabilities: number;
}

export interface SetDefaultVisibilityRequest {
  defaultVisibility: VisibilityMode;
}

export interface SetContextVisibilityRequest {
  mode: VisibilityMode;
}

export interface UpgradeGroupRequest {
  targetApplicationId: string;
  migrateMethod?: string;
}

export interface UpgradeGroupResponse {
  groupId: string;
  status: string;
  total: number | null;
  completed: number | null;
  failed: number | null;
}

export interface GroupApi {
  createGroup(
    request: CreateGroupRequest,
  ): ApiResponse<CreateGroupResponse>;
  getGroup(groupId: string): ApiResponse<GroupInfo>;
  listGroups(): ApiResponse<GroupSummary[]>;
  deleteGroup(groupId: string): ApiResponse<boolean>;

  createInvitation(
    groupId: string,
    request?: CreateInvitationRequest,
  ): ApiResponse<CreateInvitationResponse>;
  joinGroup(
    request: JoinGroupRequest,
  ): ApiResponse<JoinGroupResponse>;
  listMembers(groupId: string): ApiResponse<GroupMember[]>;
  removeMember(
    groupId: string,
    memberIdentity: string,
  ): ApiResponse<void>;
  listGroupContexts(groupId: string): ApiResponse<string[]>;
  joinGroupContext(
    groupId: string,
    request: JoinGroupContextRequest,
  ): ApiResponse<JoinGroupContextResponse>;
  syncGroup(groupId: string): ApiResponse<SyncGroupResponse>;

  getContextVisibility(
    groupId: string,
    contextId: string,
  ): ApiResponse<ContextVisibility>;
  setContextVisibility(
    groupId: string,
    contextId: string,
    request: SetContextVisibilityRequest,
  ): ApiResponse<void>;
  getContextAllowlist(
    groupId: string,
    contextId: string,
  ): ApiResponse<string[]>;
  manageContextAllowlist(
    groupId: string,
    contextId: string,
    request: ManageAllowlistRequest,
  ): ApiResponse<void>;

  getMemberCapabilities(
    groupId: string,
    identity: string,
  ): ApiResponse<MemberCapabilities>;
  setMemberCapabilities(
    groupId: string,
    identity: string,
    request: SetMemberCapabilitiesRequest,
  ): ApiResponse<void>;
  setDefaultCapabilities(
    groupId: string,
    request: SetDefaultCapabilitiesRequest,
  ): ApiResponse<void>;
  setDefaultVisibility(
    groupId: string,
    request: SetDefaultVisibilityRequest,
  ): ApiResponse<void>;

  triggerUpgrade(
    groupId: string,
    request: UpgradeGroupRequest,
  ): ApiResponse<UpgradeGroupResponse>;
  getUpgradeStatus(
    groupId: string,
  ): ApiResponse<GroupUpgradeStatus | null>;
}
