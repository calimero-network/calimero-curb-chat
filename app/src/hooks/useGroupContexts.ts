import { useState, useCallback, useRef } from "react";
import { apiClient } from "@calimero-network/calimero-client";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { FetchContextIdentitiesResponse } from "@calimero-network/calimero-client/lib/api/nodeApi";
import { GroupApiDataSource } from "../api/dataSource/groupApiDataSource";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { GroupContextChannel } from "../types/Common";
import type { SubgroupEntry } from "../api/groupApi";
import { log } from "../utils/logger";

export interface ContextIdentityMap {
  [contextId: string]: string;
}

export function useGroupContexts() {
  const [channels, setChannels] = useState<GroupContextChannel[]>([]);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [identities, setIdentities] = useState<ContextIdentityMap>({});
  const [subgroups, setSubgroups] = useState<SubgroupEntry[]>([]);
  const [channelsBySubgroup, setChannelsBySubgroup] = useState<Map<string, GroupContextChannel[]>>(new Map());
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
      const idMap: ContextIdentityMap = { ...identitiesRef.current };

      async function enrichEntries(
        entries: { contextId: string; alias?: string }[]
      ): Promise<GroupContextChannel[]> {
        const ids = entries.map((e) => e.contextId);
        await Promise.all(
          ids.filter((id) => !idMap[id]).map(async (ctxId) => {
            try {
              const resp: ResponseData<FetchContextIdentitiesResponse> =
                await apiClient.node().fetchContextIdentities(ctxId);
              const list = resp.data?.data?.identities;
              if (list && list.length > 0) idMap[ctxId] = list[0];
            } catch {
              log.debug("useGroupContexts", `No identity for context ${ctxId}`);
            }
          })
        );
        return Promise.all(
          entries.map(async ({ contextId: ctxId, alias }) => {
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
          })
        );
      }

      // Fetch namespace-level contexts (DMs and any direct namespace channels)
      const listResponse = await groupApi.listGroupContexts(groupId);
      if (listResponse.error || !listResponse.data) {
        setError(listResponse.error?.message || "Failed to fetch group contexts");
        setLoading(false);
        return;
      }
      const namespaceChannels = await enrichEntries(listResponse.data);

      // Fetch subgroups and their contexts
      let subgroupList: SubgroupEntry[] = [];
      const subgroupChannelsMap = new Map<string, GroupContextChannel[]>();

      try {
        const sgResp = await groupApi.listSubgroups(groupId);
        if (sgResp.data && sgResp.data.length > 0) {
          subgroupList = sgResp.data;
          await Promise.all(
            subgroupList.map(async (sg) => {
              const sgListResp = await groupApi.listGroupContexts(sg.groupId);
              if (sgListResp.data) {
                const sgChannels = await enrichEntries(sgListResp.data);
                subgroupChannelsMap.set(sg.groupId, sgChannels);
              }
            })
          );
        }
      } catch (e) {
        log.debug("useGroupContexts", "Failed to fetch subgroups", e);
      }

      // Flat list = namespace channels + all subgroup channels
      const allChannels: GroupContextChannel[] = [...namespaceChannels];
      subgroupChannelsMap.forEach((sgChannels) => allChannels.push(...sgChannels));

      identitiesRef.current = idMap;
      setIdentities({ ...idMap });
      setContextIds(allChannels.map((ch) => ch.contextId));
      setChannels(allChannels);
      setSubgroups(subgroupList);
      setChannelsBySubgroup(subgroupChannelsMap);
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

  const removeChannel = useCallback((contextId: string) => {
    delete identitiesRef.current[contextId];
    setChannels((prev) => prev.filter((ch) => ch.contextId !== contextId));
    setContextIds((prev) => prev.filter((id) => id !== contextId));
    setIdentities((prev) => {
      const next = { ...prev };
      delete next[contextId];
      return next;
    });
  }, []);

  return {
    channels,
    contextIds,
    identities,
    subgroups,
    channelsBySubgroup,
    loading,
    error,
    fetchGroupContexts,
    getIdentity,
    removeChannel,
  };
}
