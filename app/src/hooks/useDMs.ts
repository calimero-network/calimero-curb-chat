import { useState, useCallback } from "react";
import { GroupApiDataSource } from "../api/dataSource/groupApiDataSource";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { GroupContextChannel, ContextInfo } from "../types/Common";
import { log } from "../utils/logger";
import { apiClient } from "@calimero-network/calimero-client";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { FetchContextIdentitiesResponse } from "@calimero-network/calimero-client/lib/api/nodeApi";

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

      const listResponse = await groupApi.listGroupContexts(groupId);
      if (listResponse.error || !listResponse.data) {
        setError(listResponse.error?.message || "Failed to fetch group contexts");
        setLoading(false);
        return [];
      }

      const contextIds = listResponse.data;

      const enriched: (DMContextInfo | null)[] = await Promise.all(
        contextIds.map(async (ctxId: string) => {
          let identity: string | undefined;
          try {
            const resp: ResponseData<FetchContextIdentitiesResponse> =
              await apiClient.node().fetchContextIdentities(ctxId);
            const list = resp.data?.data?.identities;
            if (list && list.length > 0) {
              identity = list[0];
            }
          } catch {
            // No identity means we haven't joined this context
          }

          if (!identity) return null;

          let info: ContextInfo | null = null;
          try {
            const infoResp = await clientApi.getContextInfo(ctxId, identity);
            if (infoResp.data) {
              info = infoResp.data;
            }
          } catch {
            log.debug("useDMs", `get_info failed for ${ctxId}`);
          }

          if (!info || info.context_type !== "Dm") return null;

          // Fetch profiles to determine the other user
          let otherUsername = "";
          let otherIdentity = "";
          try {
            const profilesResp = await clientApi.getProfiles(ctxId, identity);
            if (profilesResp.data && Array.isArray(profilesResp.data)) {
              const other = profilesResp.data.find(
                (p: { identity: string; username: string }) => p.identity !== identity,
              );
              if (other) {
                otherUsername = other.username;
                otherIdentity = other.identity;
              }
            }
          } catch {
            log.debug("useDMs", `get_profiles failed for ${ctxId}`);
          }

          return {
            contextId: ctxId,
            info,
            otherUsername,
            otherIdentity,
            myIdentity: identity,
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
