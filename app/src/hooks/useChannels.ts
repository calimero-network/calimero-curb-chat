import { useState, useMemo } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { ChannelDataResponse } from "../api/clientApi";
import type { ChannelMeta } from "../types/Common";
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
          const channelsArray: ChannelMeta[] = response.data.map((channel) => ({
            name: channel.channelId,
            type: "channel" as const,
            channelType: channel.type,
            description: "",
            owner: channel.createdBy,
            createdByUsername: channel.createdByUsername,
            members: [],
            createdBy: channel.createdBy,
            inviteOnly: false,
            unreadMessages: {
              count: 0,
              mentions: 0,
            },
            isMember: false,
            readOnly: channel.readOnly,
            createdAt: parseTimestampToIso(channel.createdAt),
          }));

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
