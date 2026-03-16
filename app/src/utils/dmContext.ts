import type { ApiResponse } from "@calimero-network/calimero-client";
import type { GroupContextEntry } from "../api/groupApi";
import type { CreateContextResponse } from "../api/nodeApi";
import type { ContextInfo } from "../types/Common";

export const DM_CONTEXT_ALIAS_PREFIX = "DM_CONTEXT_";

export interface SharedDmDiscovery {
  source: "metadata" | "alias";
  memberIdentities: [string, string];
  otherIdentity: string;
}

interface CreateDmContextParams {
  applicationId: string;
  groupId: string;
  myIdentity: string;
  otherIdentity: string;
  otherUsername?: string;
  contextApi: {
    createGroupContext(params: {
      applicationId: string;
      protocol: string;
      groupId: string;
      initializationParams: Record<string, unknown>;
      identitySecret?: string;
      alias?: string;
    }): ApiResponse<CreateContextResponse>;
  };
  groupApi: {
    setContextVisibility(
      groupId: string,
      contextId: string,
      request: { mode: "open" | "restricted" },
    ): ApiResponse<void>;
    manageContextAllowlist(
      groupId: string,
      contextId: string,
      request: { add?: string[]; remove?: string[] },
    ): ApiResponse<void>;
  };
  onWarning?: (message: string) => void;
}

export interface CreateDmContextResult {
  data: CreateContextResponse | null;
  error: string;
  alias: string;
}

function normalizeIdentityForAlias(identity: string): string {
  return encodeURIComponent(identity.trim()).split("_").join("%5F");
}

function decodeIdentityFromAlias(value: string): string {
  return decodeURIComponent(value.split("%5F").join("_"));
}

function normalizeContextType(
  value: unknown,
): ContextInfo["context_type"] | undefined {
  if (value === "Dm" || value === "Channel") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "dm") {
      return "Dm";
    }
    if (normalized === "channel") {
      return "Channel";
    }
  }

  return undefined;
}

function normalizeMemberIdentities(value: unknown): [string, string] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const identities = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );

  if (identities.length !== 2) {
    return null;
  }

  return [identities[0], identities[1]];
}

function getMetadataValue(
  entry: GroupContextEntry,
  key: "contextType" | "context_type" | "memberIdentities" | "members" | "participants",
): unknown {
  const typedEntry = entry as GroupContextEntry & Record<string, unknown>;
  const metadata =
    typedEntry.metadata && typeof typedEntry.metadata === "object"
      ? (typedEntry.metadata as Record<string, unknown>)
      : null;

  return typedEntry[key] ?? metadata?.[key];
}

export function buildDmAlias(identityA: string, identityB: string): string {
  const ordered = [identityA.trim(), identityB.trim()].sort((left, right) =>
    left.localeCompare(right),
  );

  return `${DM_CONTEXT_ALIAS_PREFIX}${normalizeIdentityForAlias(ordered[0])}_${normalizeIdentityForAlias(ordered[1])}`;
}

export function parseDmAlias(
  alias?: string,
): { memberIdentities: [string, string] } | null {
  if (!alias?.startsWith(DM_CONTEXT_ALIAS_PREFIX)) {
    return null;
  }

  const encodedMembers = alias
    .slice(DM_CONTEXT_ALIAS_PREFIX.length)
    .split("_");

  if (encodedMembers.length !== 2) {
    return null;
  }

  try {
    return {
      memberIdentities: [
        decodeIdentityFromAlias(encodedMembers[0]),
        decodeIdentityFromAlias(encodedMembers[1]),
      ],
    };
  } catch {
    return null;
  }
}

export function getSharedDmMetadata(entry: GroupContextEntry): {
  contextType?: ContextInfo["context_type"];
  memberIdentities: [string, string] | null;
} {
  const contextType =
    normalizeContextType(getMetadataValue(entry, "contextType")) ??
    normalizeContextType(getMetadataValue(entry, "context_type")) ??
    entry.sharedContextType;

  const memberIdentities =
    normalizeMemberIdentities(getMetadataValue(entry, "memberIdentities")) ??
    normalizeMemberIdentities(getMetadataValue(entry, "members")) ??
    normalizeMemberIdentities(getMetadataValue(entry, "participants")) ??
    (entry.memberIdentities && entry.memberIdentities.length === 2
      ? [entry.memberIdentities[0], entry.memberIdentities[1]]
      : null);

  return {
    contextType,
    memberIdentities,
  };
}

export function resolveSharedDmDiscovery(
  entry: GroupContextEntry,
  currentMemberIdentity: string,
): SharedDmDiscovery | null {
  const metadata = getSharedDmMetadata(entry);
  if (
    metadata.contextType === "Dm" &&
    metadata.memberIdentities?.includes(currentMemberIdentity)
  ) {
    const otherIdentity = metadata.memberIdentities.find(
      (identity) => identity !== currentMemberIdentity,
    );
    if (otherIdentity) {
      return {
        source: "metadata",
        memberIdentities: metadata.memberIdentities,
        otherIdentity,
      };
    }
  }

  const aliasData = parseDmAlias(entry.alias);
  if (!aliasData?.memberIdentities.includes(currentMemberIdentity)) {
    return null;
  }

  const otherIdentity = aliasData.memberIdentities.find(
    (identity) => identity !== currentMemberIdentity,
  );

  if (!otherIdentity) {
    return null;
  }

  return {
    source: "alias",
    memberIdentities: aliasData.memberIdentities,
    otherIdentity,
  };
}

export function isDmContextCandidate(params: {
  entry: GroupContextEntry;
  info?: ContextInfo | null;
}): boolean {
  if (params.info?.context_type === "Dm") {
    return true;
  }

  const metadata = getSharedDmMetadata(params.entry);
  if (metadata.contextType === "Dm") {
    return true;
  }

  return parseDmAlias(params.entry.alias) !== null;
}

export function getDmDisplayName(params: {
  otherUsername?: string;
  otherAlias?: string;
  otherIdentity?: string;
  contextId: string;
}): string {
  const username = params.otherUsername?.trim();
  if (username) {
    return username;
  }

  const alias = params.otherAlias?.trim();
  if (alias) {
    return alias;
  }

  const identity = params.otherIdentity?.trim();
  if (identity) {
    return identity;
  }

  return `${params.contextId.substring(0, 8)}...`;
}

export async function createDmContextInGroup(
  params: CreateDmContextParams,
): Promise<CreateDmContextResult> {
  const alias = buildDmAlias(params.myIdentity, params.otherIdentity);
  const createResponse = await params.contextApi.createGroupContext({
    applicationId: params.applicationId,
    protocol: "near",
    groupId: params.groupId,
    alias,
    initializationParams: {
      name: params.otherUsername
        ? `DM: ${params.otherUsername}`
        : `DM: ${params.otherIdentity}`,
      context_type: "Dm",
      description: "",
      created_at: Date.now(),
    },
  });

  if (createResponse.error || !createResponse.data) {
    return {
      data: null,
      error: createResponse.error?.message || "Failed to create DM context",
      alias,
    };
  }

  const contextId = createResponse.data.contextId;
  const visibilityResponse = await params.groupApi.setContextVisibility(
    params.groupId,
    contextId,
    { mode: "restricted" },
  );
  if (visibilityResponse.error) {
    params.onWarning?.(
      `Failed to set restricted visibility: ${visibilityResponse.error.message}`,
    );
  }

  const allowlistResponse = await params.groupApi.manageContextAllowlist(
    params.groupId,
    contextId,
    { add: [params.myIdentity, params.otherIdentity] },
  );
  if (allowlistResponse.error) {
    params.onWarning?.(
      `Failed to add to allowlist: ${allowlistResponse.error.message}`,
    );
  }

  return {
    data: createResponse.data,
    error: "",
    alias,
  };
}
