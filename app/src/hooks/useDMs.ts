import { useState, useCallback } from "react";
import { GroupApiDataSource } from "../api/dataSource/groupApiDataSource";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { GroupContextChannel, ContextInfo } from "../types/Common";
import { log } from "../utils/logger";
import { apiClient } from "@calimero-network/calimero-client";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { FetchContextIdentitiesResponse } from "@calimero-network/calimero-client/lib/api/nodeApi";
import { getGroupMemberIdentity, setGroupMemberIdentity } from "../constants/config";
import { resolveSharedDmDiscovery } from "../utils/dmContext";

export interface DMContextInfo extends GroupContextChannel {
  otherUsername: string;
  otherIdentity: string;
  myIdentity: string;
}

/**
 * DM hook backed by group contexts: lists group contexts, filters those with
 * type === "dm", and enriches each with identity and metadata.
 */
export function useDMs() {
  const [dms, setDms] = useState<DMContextInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDms = useCallback(async (groupId?: string) => {
    if (!groupId) {
      return [];
    }
    setLoading(true);
    setError(null);

    try {
      const groupApi = new GroupApiDataSource();
      const clientApi = new ClientApiDataSource();
      const currentIdentityResponse = await groupApi.resolveCurrentMemberIdentity(
        groupId,
        getGroupMemberIdentity(groupId),
      );
      const currentMemberIdentity = currentIdentityResponse.data?.memberIdentity ?? "";
      if (currentMemberIdentity) {
        setGroupMemberIdentity(groupId, currentMemberIdentity);
      }

      const listResponse = await groupApi.listGroupContexts(groupId);
      if (listResponse.error || !listResponse.data) {
        setError(listResponse.error?.message || "Failed to fetch group contexts");
        setLoading(false);
        return [];
      }

      const contextEntries = listResponse.data;

      const enriched: (DMContextInfo | null)[] = await Promise.all(
        contextEntries.map(async (entry) => {
          const { contextId: ctxId, alias } = entry;
          const discovery = currentMemberIdentity
            ? resolveSharedDmDiscovery(entry, currentMemberIdentity)
            : null;

          let joinedIdentity: string | undefined;
          try {
            const resp: ResponseData<FetchContextIdentitiesResponse> =
              await apiClient.node().fetchContextIdentities(ctxId);
            const list = resp.data?.data?.identities;
            if (list && list.length > 0) {
              joinedIdentity = list[0];
            }
          } catch {
            // No identity means we haven't joined this context
          }

          let info: ContextInfo | null = null;
          if (joinedIdentity) {
            try {
              const infoResp = await clientApi.getContextInfo(ctxId, joinedIdentity);
              if (infoResp.data) {
                info = infoResp.data;
              }
            } catch {
              log.debug("useDMs", `get_info failed for ${ctxId}`);
            }
          }

          if (info && info.context_type !== "Dm") {
            return null;
          }

          const shouldInclude =
            info?.context_type === "Dm" || (!info && Boolean(discovery));
          if (!shouldInclude) {
            return null;
          }

          let otherUsername = "";
          let otherIdentity = discovery?.otherIdentity || "";

          if (joinedIdentity) {
            try {
              const profilesResp = await clientApi.getProfiles(ctxId, joinedIdentity);
              if (profilesResp.data && Array.isArray(profilesResp.data)) {
                const other = profilesResp.data.find(
                  (p: { identity: string; username: string }) =>
                    p.identity !== joinedIdentity,
                );
                if (other) {
                  otherUsername = other.username;
                  otherIdentity = other.identity;
                }
              }
            } catch {
              log.debug("useDMs", `get_profiles failed for ${ctxId}`);
            }
          }

          return {
            contextId: ctxId,
            alias,
            info,
            otherUsername,
            otherIdentity,
            myIdentity: joinedIdentity || "",
            contextIdentity: joinedIdentity,
            isJoined: Boolean(joinedIdentity),
          };
        }),
      );

      const dmList = enriched.filter((d): d is DMContextInfo => d !== null);
      setDms(dmList);
      return dmList;
    } catch (err) {
      log.error("useDMs", "Error fetching DMs", err);
      setError("Failed to fetch DMs");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    dms,
    loading,
    error,
    fetchDms,
  };
}
