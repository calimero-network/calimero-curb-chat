import { useState, useCallback, useMemo } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import { log } from "../utils/logger";

/**
 * Custom hook for managing channel-specific members and non-invited users
 */
export function useChannelMembers() {
  const clientApiDataSource = useMemo(() => new ClientApiDataSource(), []);
  const [channelUsers, setChannelUsers] = useState<Record<string, string>>({});
  const [nonInvitedUsers, setNonInvitedUsers] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannelMembers = useCallback(async (_channelId: string) => {
    setLoading(true);
    setError(null);

    try {
      // const response: ResponseData<Map<string, string>> =
      //   await new ClientApiDataSource().getChannelMembers({
      //     channel: { name: channelId },
      //   });

      // if (response.data) {
      //   setChannelUsers(response.data);
      // } else if (response.error) {
      //   setError(response.error.message || "Failed to fetch channel members");
      // }
      setChannelUsers({});
    } catch (err) {
      log.error("ChannelMembers", "Error fetching channel members", err);
      setError("Failed to fetch channel members");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNonInvitedUsers = useCallback(async (channelId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await clientApiDataSource.getNonMemberUsers({
        channel: { name: channelId },
      });

      
      if (response.data) {
        setNonInvitedUsers(response.data);
      } else if (response.error) {
        setError(response.error.message || "Failed to fetch non-invited users");
      }
    } catch (err) {
      log.error("ChannelMembers", "Error fetching non-invited users", err);
      setError("Failed to fetch non-invited users");
    } finally {
      setLoading(false);
    }
  }, [clientApiDataSource]);

  const fetchBoth = useCallback(
    async (channelId: string) => {
      await Promise.all([
        fetchChannelMembers(channelId),
        fetchNonInvitedUsers(channelId),
      ]);
    },
    [fetchChannelMembers, fetchNonInvitedUsers],
  );

  const setChannelUsersDirect = useCallback(
    (users: Record<string, string>) => {
      setChannelUsers({ ...users });
    },
    [],
  );

  const setNonInvitedUsersDirect = useCallback(
    (users: Record<string, string>) => {
      setNonInvitedUsers({ ...users });
    },
    [],
  );

  return {
    channelUsers,
    nonInvitedUsers,
    loading,
    error,
    fetchChannelMembers,
    fetchNonInvitedUsers,
    fetchBoth,
    setChannelUsers: setChannelUsersDirect,
    setNonInvitedUsers: setNonInvitedUsersDirect,
  };
}
