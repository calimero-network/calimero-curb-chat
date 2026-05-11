import { useState, useCallback, useRef } from "react";
import type { ResponseData } from "../api/types";
import {
  nodeApi as apiClientNode,
  type LegacyFetchContextIdentitiesResponse as FetchContextIdentitiesResponse,
} from "../api/meroJsClient";
import { GroupApiDataSource } from "../api/dataSource/groupApiDataSource";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { GroupContextChannel } from "../types/Common";
import type { SubgroupEntry } from "../api/groupApi";
import { log } from "../utils/logger";

const LEFT_CONTEXTS_KEY = "curb:left_contexts";

function readLeftContexts(): Set<string> {
  try {
    const raw = localStorage.getItem(LEFT_CONTEXTS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* */ }
  return new Set();
}

function writeLeftContexts(ids: Set<string>) {
  try {
    localStorage.setItem(LEFT_CONTEXTS_KEY, JSON.stringify([...ids]));
  } catch { /* */ }
}

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
  const leftContextIdsRef = useRef<Set<string>>(readLeftContexts());

  const fetchGroupContexts = useCallback(async (groupId: string) => {
    if (!groupId) return;
    setLoading(true);
    setError(null);

    try {
      const groupApi = new GroupApiDataSource();
      const clientApi = new ClientApiDataSource();
      const idMap: ContextIdentityMap = { ...identitiesRef.current };

      async function enrichEntries(
        entries: { contextId: string; alias?: string }[],
        visibility?: "open" | "restricted",
      ): Promise<GroupContextChannel[]> {
        const filtered = entries.filter((e) => !leftContextIdsRef.current.has(e.contextId));
        const ids = filtered.map((e) => e.contextId);
        await Promise.all(
          ids.filter((id) => !idMap[id]).map(async (ctxId) => {
            try {
              const resp: ResponseData<FetchContextIdentitiesResponse> =
                await apiClientNode.fetchContextIdentities(ctxId);
              const list = resp.data?.data?.identities;
              if (list && list.length > 0) idMap[ctxId] = list[0];
            } catch {
              log.debug("useGroupContexts", `No identity for context ${ctxId}`);
            }
          })
        );
        return Promise.all(
          filtered.map(async ({ contextId: ctxId, alias }) => {
            const executor = idMap[ctxId];
            if (!executor) {
              return {
                contextId: ctxId,
                alias,
                info: null,
                visibility,
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
                  visibility,
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
              visibility,
              contextIdentity: executor,
              isJoined: true,
            };
          })
        );
      }

      // 1-group-per-context model: each subgroup under the namespace IS a
      // channel-group with exactly one context inside. The subgroup's
      // VisibilityMode (open|restricted) is the channel's public/private
      // flag. DMs are also subgroups (restricted, 2 members) — caller
      // distinguishes them via `info.context_type`.
      let subgroupList: SubgroupEntry[] = [];
      const subgroupChannelsMap = new Map<string, GroupContextChannel[]>();

      try {
        const sgResp = await groupApi.listSubgroups(groupId);
        if (sgResp.data && sgResp.data.length > 0) {
          subgroupList = sgResp.data;
          await Promise.all(
            subgroupList.map(async (sg) => {
              const [sgListResp, sgInfoResp] = await Promise.all([
                groupApi.listGroupContexts(sg.groupId),
                groupApi.getGroup(sg.groupId).catch(() => null),
              ]);
              const visibility = sgInfoResp?.data?.subgroupVisibility;
              if (sgListResp.data) {
                const sgChannels = await enrichEntries(sgListResp.data, visibility);
                subgroupChannelsMap.set(sg.groupId, sgChannels);
              }
            })
          );
        }
      } catch (e) {
        log.debug("useGroupContexts", "Failed to fetch subgroups", e);
      }

      const allChannels: GroupContextChannel[] = [];
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

  const getSubgroupForContext = useCallback(
    (contextId: string): string | undefined => {
      for (const [subgroupId, sgChannels] of channelsBySubgroup.entries()) {
        if (sgChannels.some((ch) => ch.contextId === contextId)) {
          return subgroupId;
        }
      }
      return undefined;
    },
    [channelsBySubgroup],
  );

  const getIdentity = useCallback(
    (contextId: string): string | undefined => identitiesRef.current[contextId],
    [],
  );

  const removeChannel = useCallback((contextId: string) => {
    delete identitiesRef.current[contextId];
    leftContextIdsRef.current.add(contextId);
    writeLeftContexts(leftContextIdsRef.current);
    setChannels((prev) => prev.filter((ch) => ch.contextId !== contextId));
    setContextIds((prev) => prev.filter((id) => id !== contextId));
    setIdentities((prev) => {
      const next = { ...prev };
      delete next[contextId];
      return next;
    });
  }, []);

  const unblockChannel = useCallback((contextId: string) => {
    leftContextIdsRef.current.delete(contextId);
    writeLeftContexts(leftContextIdsRef.current);
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
    getSubgroupForContext,
    removeChannel,
    unblockChannel,
  };
}
