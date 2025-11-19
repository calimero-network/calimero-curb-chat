import { useState, useCallback } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { DMChatInfo } from "../api/clientApi";
import { log } from "../utils/logger";

/**
 * Simplified DM hook - no debouncing, just direct fetching
 * Debouncing is handled by the callers
 */
export function useDMs() {
  const [dms, setDms] = useState<DMChatInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple, stable fetch function
  const fetchDms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response: ResponseData<DMChatInfo[]> =
        await new ClientApiDataSource().getDms();

      if (response.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // @ts-expect-error - response.data.data.result is not typed
        const transformedDms = response.data.data.result.map((dm: any) => ({
          channel_type: dm.channel_type,
          created_at: dm.created_at,
          created_by: dm.created_by,
          channel_user: dm.channel_user,
          context_id: dm.context_id,
          other_identity_new: dm.other_identity_new,
          other_identity_old: dm.other_identity_old,
          other_username: dm.other_username,
          own_identity: dm.own_identity,
          own_identity_old: dm.own_identity_old,
          own_username: dm.own_username,
          did_join: dm.did_join,
          invitation_payload: dm.invitation_payload,
          old_hash: dm.old_hash,
          new_hash: dm.new_hash,
          unread_messages: dm.unread_messages,
        }));

        setDms(transformedDms);
        return response.data;
      } else if (response.error) {
        setError(response.error.message || "Failed to fetch DMs");
        return [];
      }
    } catch (err) {
      log.error("DMs", "Error fetching DMs", err);
      setError("Failed to fetch DMs");
      return [];
    } finally {
      setLoading(false);
    }
    try {
      setDms([]);
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
