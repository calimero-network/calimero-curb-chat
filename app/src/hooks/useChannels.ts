import { useState, useCallback, useMemo } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { Channels } from "../api/clientApi";
import type { ChannelMeta } from "../types/Common";
import { DEBOUNCE_FETCH_DELAY_MS } from "../constants/app";
import { debounce } from "../utils/debounce";

/**
 * Custom hook for managing channels
 * Handles fetching, caching, and debounced updates
 */
export function useChannels() {
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response: ResponseData<Channels> =
        await new ClientApiDataSource().getChannels();
      
      if (response.data) {
        const channelsArray: ChannelMeta[] = Object.entries(response.data).map(
          ([name, channelInfo]) => ({
            name,
            type: "channel" as const,
            channelType: channelInfo.channel_type,
            description: "",
            owner: channelInfo.created_by,
            createdByUsername: channelInfo.created_by_username,
            members: [],
            createdBy: channelInfo.created_by,
            inviteOnly: false,
            unreadMessages: {
              count: channelInfo.unread_count,
              mentions: channelInfo.unread_mention_count,
            },
            isMember: false,
            readOnly: channelInfo.read_only,
            createdAt: new Date(channelInfo.created_at * 1000).toISOString(),
          })
        );
        setChannels(channelsArray);
      } else if (response.error) {
        setError(response.error.message || "Failed to fetch channels");
      }
    } catch (err) {
      console.error("Error fetching channels:", err);
      setError("Failed to fetch channels");
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoized debounced version
  const debouncedFetch = useMemo(
    () => debounce(fetchChannels, DEBOUNCE_FETCH_DELAY_MS),
    [fetchChannels]
  );

  return {
    channels,
    loading,
    error,
    fetchChannels,
    debouncedFetchChannels: debouncedFetch,
  };
}

