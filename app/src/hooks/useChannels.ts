import { useState, useMemo } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import { getExecutorPublicKey } from "@calimero-network/calimero-client";
import type {
  ChannelDataResponse,
  ChannelMember,
} from "../api/clientApi";
import { ChannelType } from "../api/clientApi";
import type { ChannelMeta, User } from "../types/Common";
import { log } from "../utils/logger";

/**
 * Simplified Channels hook - no debouncing, just direct fetching
 * Debouncing is handled by the callers
 */
export function useChannels() {
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientApiDataSource = useMemo(() => new ClientApiDataSource(), []);

  const fetchChannels = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);

      try {
        const response: ResponseData<ChannelDataResponse[]> = await clientApiDataSource.getChannels();
        if (response.data) {
          const currentUserId = getExecutorPublicKey() || "";

          const channelsArray: ChannelMeta[] = response.data.map((channel) => {
            const membersMap = new Map<string, User>();

            const upsertMember = (
              member: ChannelMember,
              isModerator: boolean,
            ) => {
              membersMap.set(member.publicKey, {
                id: member.publicKey,
                name: member.username,
                moderator: isModerator,
                active: true,
              });
            };

            channel.members.forEach((member) => upsertMember(member, false));
            channel.moderators.forEach((moderator) =>
              upsertMember(moderator, true),
            );

            const members = Array.from(membersMap.values());
            const isMember = currentUserId
              ? membersMap.has(currentUserId)
              : members.length > 0;
            const moderators = members.filter((member) => member.moderator);

            return {
              name: channel.channelId,
              type: "channel" as const,
              channelType: channel.type,
              description: "",
              owner: channel.createdBy,
              createdByUsername: channel.createdByUsername,
              members,
              moderators,
              createdBy: channel.createdBy,
              inviteOnly: channel.type === ChannelType.PRIVATE,
              unreadMessages: {
                count: 0,
                mentions: 0,
              },
              isMember,
              readOnly: channel.readOnly,
              createdAt: parseTimestampToIso(channel.createdAt),
            };
          });

          setChannels(channelsArray);
        } else if (response.error) {
          setError(response.error.message || "Failed to fetch channels");
        }
      } catch (err) {
        log.error("Channels", "Error fetching channels", err);
        setError("Failed to fetch channels");
      } finally {
        setLoading(false);
      }
    },
    [clientApiDataSource],
  );

  function parseTimestampToIso(
    rawTimestamp: number | string | null | undefined,
  ): string {
    if (rawTimestamp === null || rawTimestamp === undefined) {
      return new Date(0).toISOString();
    }

    const numericTimestamp =
      typeof rawTimestamp === "string" ? Number(rawTimestamp) : rawTimestamp;

    if (!Number.isFinite(numericTimestamp)) {
      return new Date(0).toISOString();
    }

    let timestampMs = numericTimestamp;

    if (numericTimestamp > 1e15) {
      timestampMs = numericTimestamp / 1_000_000;
    } else if (numericTimestamp > 1e12) {
      timestampMs = numericTimestamp / 1_000;
    } else if (numericTimestamp > 1e10) {
      timestampMs = numericTimestamp;
    } else {
      timestampMs = numericTimestamp * 1_000;
    }

    return new Date(timestampMs).toISOString();
  }

  return {
    channels,
    loading,
    error,
    fetchChannels,
  };
}
