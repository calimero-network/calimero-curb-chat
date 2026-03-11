import { useState, useCallback } from "react";
import { GroupApiDataSource } from "../api/dataSource/groupApiDataSource";
import { log } from "../utils/logger";

export function useGroupContexts() {
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroupContexts = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response =
        await new GroupApiDataSource().listGroupContexts(groupId);

      if (response.data) {
        setContextIds(response.data);
      } else if (response.error) {
        setError(
          response.error.message || "Failed to fetch group contexts",
        );
      }
    } catch (err) {
      log.error("GroupContexts", "Error fetching group contexts", err);
      setError("Failed to fetch group contexts");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    contextIds,
    loading,
    error,
    fetchGroupContexts,
  };
}
