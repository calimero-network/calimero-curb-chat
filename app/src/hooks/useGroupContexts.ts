import { useState, useCallback, useRef } from "react";
import { apiClient } from "@calimero-network/calimero-client";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { FetchContextIdentitiesResponse } from "@calimero-network/calimero-client/lib/api/nodeApi";
import { GroupApiDataSource } from "../api/dataSource/groupApiDataSource";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { GroupContextChannel } from "../types/Common";
import { log } from "../utils/logger";

export interface ContextIdentityMap {
  [contextId: string]: string;
}

export function useGroupContexts() {
  const [channels, setChannels] = useState<GroupContextChannel[]>([]);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [identities, setIdentities] = useState<ContextIdentityMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identitiesRef = useRef<ContextIdentityMap>({});

  const fetchGroupContexts = useCallback(async (groupId: string) => {
    if (!groupId) return;
    setLoading(true);
    setError(null);

    try {
      const groupApi = new GroupApiDataSource();
      const clientApi = new ClientApiDataSource();

      const listResponse = await groupApi.listGroupContexts(groupId);
      if (listResponse.error || !listResponse.data) {
        setError(listResponse.error?.message || "Failed to fetch group contexts");
        setLoading(false);
        return;
      }

      const contextEntries = listResponse.data;
      const ids = contextEntries.map((entry) => entry.contextId);
      setContextIds(ids);

      const idMap: ContextIdentityMap = { ...identitiesRef.current };

      // Fetch identities for contexts we don't have yet
      const identityPromises = ids
        .filter((id: string) => !idMap[id])
        .map(async (ctxId: string) => {
          try {
            const resp: ResponseData<FetchContextIdentitiesResponse> =
              await apiClient.node().fetchContextIdentities(ctxId);
            const list = resp.data?.data?.identities;
            if (list && list.length > 0) {
              idMap[ctxId] = list[0];
            }
          } catch {
            log.debug("useGroupContexts", `No identity for context ${ctxId}`);
          }
        });

      await Promise.all(identityPromises);
      identitiesRef.current = idMap;
      setIdentities({ ...idMap });

      // Fetch get_info() for each context where we have an identity
      const enriched: GroupContextChannel[] = await Promise.all(
        contextEntries.map(async ({ contextId: ctxId, alias }) => {
          const executor = idMap[ctxId];
          if (!executor) {
            return {
              contextId: ctxId,
              alias,
              info: null,
              contextIdentity: undefined,
              isJoined: false,
            };
          }
          try {
            const infoResp = await clientApi.getContextInfo(ctxId, executor);
            if (infoResp.data) {
              return {
                contextId: ctxId,
                alias,
                info: infoResp.data,
                contextIdentity: executor,
                isJoined: true,
              };
            }
          } catch (err) {
            log.debug("useGroupContexts", `get_info failed for ${ctxId}`, err);
          }
          return {
            contextId: ctxId,
            alias,
            info: null,
            contextIdentity: executor,
            isJoined: true,
          };
        }),
      );

      setChannels(enriched);
    } catch (err) {
      log.error("useGroupContexts", "Error fetching group contexts", err);
      setError("Failed to fetch group contexts");
    } finally {
      setLoading(false);
    }
  }, []);

  const getIdentity = useCallback(
    (contextId: string): string | undefined => identitiesRef.current[contextId],
    [],
  );

  return {
    channels,
    contextIds,
    identities,
    loading,
    error,
    fetchGroupContexts,
    getIdentity,
  };
}
