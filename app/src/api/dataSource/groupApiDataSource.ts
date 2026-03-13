import axios from "axios";
import bs58 from "bs58";
import {
  getAppEndpointKey,
  getAuthConfig,
  type ApiResponse,
} from "@calimero-network/calimero-client";
import type {
  ContextVisibility,
  CreateGroupRequest,
  CreateGroupResponse,
  CreateInvitationRequest,
  CreateInvitationResponse,
  GroupApi,
  GroupInfo,
  SignedGroupOpenInvitation,
  GroupMember,
  GroupSummary,
  GroupUpgradeStatus,
  JoinGroupContextRequest,
  JoinGroupContextResponse,
  JoinGroupRequest,
  JoinGroupResponse,
  ManageAllowlistRequest,
  MemberCapabilities,
  RemoveMemberRequest,
  SetContextVisibilityRequest,
  SetDefaultCapabilitiesRequest,
  SetDefaultVisibilityRequest,
  SetMemberCapabilitiesRequest,
  SyncGroupResponse,
  UpgradeGroupRequest,
  UpgradeGroupResponse,
} from "../groupApi";
import { parseGroupInvitationPayload } from "../../utils/invitation";
import { resolveCurrentGroupMemberIdentity } from "../../utils/groupMemberIdentity";

const DEFAULT_NODE_ENDPOINT = "http://localhost:2428";

function getNodeEndpoint(): string {
  return getAppEndpointKey() || DEFAULT_NODE_ENDPOINT;
}

function getAuthHeaders(): Record<string, string> {
  const authConfig = getAuthConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authConfig?.jwtToken) {
    headers["Authorization"] = `Bearer ${authConfig.jwtToken}`;
  }
  return headers;
}

type Result<T> = Awaited<ApiResponse<T>>;

function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

function fail<T>(code: number, message: string): Result<T> {
  return { data: null, error: { code, message } };
}

function httpFail<T>(status: number, statusText: string): Result<T> {
  return fail(status, statusText);
}

function isHexContextId(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

function normalizeContextId(value: string): string {
  if (!isHexContextId(value)) {
    return value;
  }

  try {
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < value.length; index += 2) {
      bytes[index / 2] = parseInt(value.slice(index, index + 2), 16);
    }
    return bs58.encode(bytes);
  } catch {
    return value;
  }
}

function isSignedGroupOpenInvitation(
  value: unknown,
): value is SignedGroupOpenInvitation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const typedValue = value as {
    invitation?: Record<string, unknown>;
    inviterSignature?: unknown;
    inviter_signature?: unknown;
  };

  return (
    (typeof typedValue.inviterSignature === "string" ||
      typeof typedValue.inviter_signature === "string") &&
    !!typedValue.invitation &&
    typeof typedValue.invitation === "object"
  );
}

function normalizeGroupInvitation(
  value: unknown,
): SignedGroupOpenInvitation | null {
  if (isSignedGroupOpenInvitation(value)) {
    return value;
  }

  if (typeof value === "string") {
    return parseGroupInvitationPayload(value);
  }

  if (value && typeof value === "object") {
    const typedValue = value as { invitation?: unknown; payload?: unknown };
    if (typedValue.invitation && isSignedGroupOpenInvitation(typedValue.invitation)) {
      return typedValue.invitation;
    }
    if (typeof typedValue.payload === "string") {
      return parseGroupInvitationPayload(typedValue.payload);
    }
  }

  return null;
}

function catchError<T>(context: string, error: unknown): Result<T> {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    const responseError = error.response?.data?.error;
    const message =
      typeof responseError === "string"
        ? responseError
        : error.message || `An unexpected error occurred during ${context}`;
    console.error(`${context} failed:`, error);
    return fail(status, message);
  }

  const message =
    error instanceof Error
      ? error.message
      : `An unexpected error occurred during ${context}`;
  console.error(`${context} failed:`, error);
  return fail(500, message);
}

export class GroupApiDataSource implements GroupApi {
  private base(): string {
    return `${getNodeEndpoint()}/admin-api`;
  }

  async createGroup(
    request: CreateGroupRequest,
  ): ApiResponse<CreateGroupResponse> {
    try {
      const response = await axios.post(`${this.base()}/groups`, request, {
        headers: getAuthHeaders(),
      });
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("createGroup", error);
    }
  }

  async getGroup(groupId: string): ApiResponse<GroupInfo> {
    try {
      const response = await axios.get(`${this.base()}/groups/${groupId}`, {
        headers: getAuthHeaders(),
      });
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("getGroup", error);
    }
  }

  async listGroups(): ApiResponse<GroupSummary[]> {
    try {
      const response = await axios.get(`${this.base()}/groups`, {
        headers: getAuthHeaders(),
      });
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("listGroups", error);
    }
  }

  async deleteGroup(groupId: string): ApiResponse<boolean> {
    try {
      const response = await axios.delete(`${this.base()}/groups/${groupId}`, {
        headers: getAuthHeaders(),
      });
      return response.status === 200
        ? ok(response.data.data?.isDeleted ?? true)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("deleteGroup", error);
    }
  }

  async createInvitation(
    groupId: string,
    request?: CreateInvitationRequest,
  ): ApiResponse<CreateInvitationResponse> {
    try {
      const response = await axios.post(
        `${this.base()}/groups/${groupId}/invite`,
        request ?? {},
        { headers: getAuthHeaders() },
      );
      if (response.status !== 200) {
        return httpFail(response.status, response.statusText);
      }

      const invitation = normalizeGroupInvitation(response.data.data);
      if (!invitation) {
        return fail(500, "Invalid workspace invitation response");
      }

      return ok({ invitation });
    } catch (error) {
      return catchError("createInvitation", error);
    }
  }

  async joinGroup(
    request: JoinGroupRequest,
  ): ApiResponse<JoinGroupResponse> {
    try {
      const response = await axios.post(
        `${this.base()}/groups/join`,
        {
          invitation: request.invitation,
        },
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("joinGroup", error);
    }
  }

  async listMembers(groupId: string): ApiResponse<GroupMember[]> {
    try {
      const response = await axios.get(
        `${this.base()}/groups/${groupId}/members`,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("listMembers", error);
    }
  }

  async resolveCurrentMemberIdentity(
    groupId: string,
    storedMemberIdentity = "",
  ): ApiResponse<{ memberIdentity: string; members: GroupMember[] }> {
    const membersResponse = await this.listMembers(groupId);
    if (membersResponse.error || !membersResponse.data) {
      return {
        data: null,
        error:
          membersResponse.error ??
          {
            code: 500,
            message: "Failed to list workspace members",
          },
      };
    }

    const resolution = resolveCurrentGroupMemberIdentity({
      members: membersResponse.data,
      storedMemberIdentity,
    });

    if (!resolution.memberIdentity) {
      return fail(
        404,
        "Could not resolve this node's workspace identity. Rejoin this workspace from an invitation on this device or select a workspace already joined here.",
      );
    }

    return ok({
      memberIdentity: resolution.memberIdentity,
      members: membersResponse.data,
    });
  }

  async removeMember(
    groupId: string,
    memberIdentity: string,
  ): ApiResponse<void> {
    try {
      const body: RemoveMemberRequest = { members: [memberIdentity] };
      const response = await axios.post(
        `${this.base()}/groups/${groupId}/members/remove`,
        body,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(undefined as void)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("removeMember", error);
    }
  }

  async listGroupContexts(groupId: string): ApiResponse<string[]> {
    try {
      const response = await axios.get(
        `${this.base()}/groups/${groupId}/contexts`,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok((response.data.data as string[]).map((contextId) => normalizeContextId(contextId)))
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("listGroupContexts", error);
    }
  }

  async joinGroupContext(
    groupId: string,
    request: JoinGroupContextRequest,
  ): ApiResponse<JoinGroupContextResponse> {
    try {
      const normalizedRequest: JoinGroupContextRequest = {
        contextId: normalizeContextId(request.contextId),
      };
      const response = await axios.post(
        `${this.base()}/groups/${groupId}/join-context`,
        normalizedRequest,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("joinGroupContext", error);
    }
  }

  async syncGroup(groupId: string): ApiResponse<SyncGroupResponse> {
    try {
      const response = await axios.post(
        `${this.base()}/groups/${groupId}/sync`,
        {},
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("syncGroup", error);
    }
  }

  async getContextVisibility(
    groupId: string,
    contextId: string,
  ): ApiResponse<ContextVisibility> {
    try {
      const response = await axios.get(
        `${this.base()}/groups/${groupId}/contexts/${contextId}/visibility`,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("getContextVisibility", error);
    }
  }

  async setContextVisibility(
    groupId: string,
    contextId: string,
    request: SetContextVisibilityRequest,
  ): ApiResponse<void> {
    try {
      const response = await axios.put(
        `${this.base()}/groups/${groupId}/contexts/${contextId}/visibility`,
        request,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(undefined as void)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("setContextVisibility", error);
    }
  }

  async getContextAllowlist(
    groupId: string,
    contextId: string,
  ): ApiResponse<string[]> {
    try {
      const response = await axios.get(
        `${this.base()}/groups/${groupId}/contexts/${contextId}/allowlist`,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("getContextAllowlist", error);
    }
  }

  async manageContextAllowlist(
    groupId: string,
    contextId: string,
    request: ManageAllowlistRequest,
  ): ApiResponse<void> {
    try {
      const response = await axios.post(
        `${this.base()}/groups/${groupId}/contexts/${contextId}/allowlist`,
        request,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(undefined as void)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("manageContextAllowlist", error);
    }
  }

  async getMemberCapabilities(
    groupId: string,
    identity: string,
  ): ApiResponse<MemberCapabilities> {
    try {
      const response = await axios.get(
        `${this.base()}/groups/${groupId}/members/${identity}/capabilities`,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("getMemberCapabilities", error);
    }
  }

  async setMemberCapabilities(
    groupId: string,
    identity: string,
    request: SetMemberCapabilitiesRequest,
  ): ApiResponse<void> {
    try {
      const response = await axios.put(
        `${this.base()}/groups/${groupId}/members/${identity}/capabilities`,
        request,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(undefined as void)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("setMemberCapabilities", error);
    }
  }

  async setDefaultCapabilities(
    groupId: string,
    request: SetDefaultCapabilitiesRequest,
  ): ApiResponse<void> {
    try {
      const response = await axios.put(
        `${this.base()}/groups/${groupId}/settings/default-capabilities`,
        request,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(undefined as void)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("setDefaultCapabilities", error);
    }
  }

  async setDefaultVisibility(
    groupId: string,
    request: SetDefaultVisibilityRequest,
  ): ApiResponse<void> {
    try {
      const response = await axios.put(
        `${this.base()}/groups/${groupId}/settings/default-visibility`,
        request,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(undefined as void)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("setDefaultVisibility", error);
    }
  }

  async triggerUpgrade(
    groupId: string,
    request: UpgradeGroupRequest,
  ): ApiResponse<UpgradeGroupResponse> {
    try {
      const response = await axios.post(
        `${this.base()}/groups/${groupId}/upgrade`,
        request,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("triggerUpgrade", error);
    }
  }

  async getUpgradeStatus(
    groupId: string,
  ): ApiResponse<GroupUpgradeStatus | null> {
    try {
      const response = await axios.get(
        `${this.base()}/groups/${groupId}/upgrade/status`,
        { headers: getAuthHeaders() },
      );
      return response.status === 200
        ? ok(response.data.data ?? null)
        : httpFail(response.status, response.statusText);
    } catch (error) {
      return catchError("getUpgradeStatus", error);
    }
  }
}
