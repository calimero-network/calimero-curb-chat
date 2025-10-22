import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import type { ResponseData } from "@calimero-network/calimero-client";
import type { DMChatInfo } from "../api/clientApi";
import { DEBOUNCE_FETCH_DELAY_MS } from "../constants/app";
import { debounce } from "../utils/debounce";
import { log } from "../utils/logger";

/**
 * Custom hook for managing Direct Messages
 * Handles fetching DMs and debounced updates
 */
export function useDMs(playSoundForMessage?: (id: string, type: any, isCurrentChat?: boolean) => void) {
  const [dms, setDms] = useState<DMChatInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to avoid including playSoundForMessage in dependencies
  const playSoundRef = useRef(playSoundForMessage);
  
  useEffect(() => {
    playSoundRef.current = playSoundForMessage;
  }, [playSoundForMessage]);

  const fetchDms = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response: ResponseData<DMChatInfo[]> =
        await new ClientApiDataSource().getDms();
      
      if (response.data) {
        // Play sound for unread DMs if sound handler provided
        if (playSoundRef.current) {
          response.data.forEach((dm) => {
            if (dm.unread_messages > 0) {
              playSoundRef.current?.(`dm-${dm.other_identity_old}`, 'dm');
            }
          });
        }
        
        setDms(response.data);
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
  }, []); // No dependencies needed - uses ref

  // Memoized debounced version with cleanup
  const debouncedFetch = useMemo(
    () => debounce(fetchDms, DEBOUNCE_FETCH_DELAY_MS),
    [fetchDms]
  );
  
  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedFetch.cancel();
    };
  }, [debouncedFetch]);

  return {
    dms,
    loading,
    error,
    fetchDms,
    debouncedFetchDms: debouncedFetch,
  };
}

