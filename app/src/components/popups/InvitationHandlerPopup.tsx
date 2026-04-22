import { useState, useEffect, useRef, useCallback } from "react";
import { styled } from "styled-components";
import {
  apiClient,
  type ResponseData,
  setContextId,
  setExecutorPublicKey,
} from "@calimero-network/calimero-client";
import type {
  JoinContextResponse,
  NodeIdentity,
  SignedOpenInvitation,
} from "@calimero-network/calimero-client/lib/api/nodeApi";
import { Button } from "@calimero-network/mero-ui";
import {
  clearInvitationFromStorage,
  getInvitationFromStorage,
} from "../../utils/invitation";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import {
  setGroupId,
  setGroupMemberIdentity,
  setStoredGroupAlias,
  setContextMemberIdentity,
} from "../../constants/config";
import { parseGroupInvitationPayload } from "../../utils/invitation";

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  backdrop-filter: blur(8px);
`;

const PopupContainer = styled.div`
  background: #1a1a1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
`;

const Title = styled.h2`
  color: #ffffff;
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
`;

const Message = styled.div<{ $type?: "success" | "error" | "info" }>`
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 1rem;
  color: ${({ $type }) =>
    $type === "success"
      ? "#27ae60"
      : $type === "error"
        ? "#e74c3c"
        : "#b8b8d1"};
  background: ${({ $type }) =>
    $type === "success"
      ? "rgba(39, 174, 96, 0.1)"
      : $type === "error"
        ? "rgba(231, 76, 60, 0.1)"
        : "rgba(184, 184, 209, 0.1)"};
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

type Status =
  | "joining"
  | "syncing"
  | "discovering-contexts"
  | "syncing-context"
  | "error";

interface InvitationHandlerPopupProps {
  onSuccess: () => void;
  onError: () => void;
}

/**
 * Detect whether the stored invitation is a group invitation or a legacy
 * context invitation.
 *
 * Legacy context invitations are JSON objects (SignedOpenInvitation) with
 * `invitation` and `invitee_signature` fields.
 *
 * Group invitations are transparent JSON with `invitation` and
 * `inviter_signature` fields. Legacy context invitations also use JSON, so we
 * inspect the payload shape instead of assuming that JSON always means context.
 */
function isGroupInvitation(payload: string): boolean {
  return !!parseGroupInvitationPayload(payload);
}

export default function InvitationHandlerPopup({
  onSuccess,
  onError,
}: InvitationHandlerPopupProps) {
  const [status, setStatus] = useState<Status>("joining");
  const [statusMessage, setStatusMessage] = useState("Processing your invitation...");
  const [errorMessage, setErrorMessage] = useState("");
  const hasAttemptedJoin = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const joinGroupFlow = useCallback(
    async (invitationPayload: string) => {
      const groupApi = new GroupApiDataSource();

      setStatus("joining");
      setStatusMessage("Joining workspace...");

      const parsedInvitation = parseGroupInvitationPayload(invitationPayload);
      if (!parsedInvitation) {
        throw new Error("Invalid workspace invitation");
      }

      const joinResult = await groupApi.joinGroup({
        invitation: parsedInvitation.invitation,
        groupAlias: parsedInvitation.groupAlias,
      });
      if (joinResult.error || !joinResult.data) {
        throw new Error(
          joinResult.error?.message || "Failed to join workspace",
        );
      }
      const { groupId, memberIdentity } = joinResult.data;
      setGroupId(groupId);
      setGroupMemberIdentity(groupId, memberIdentity);
      if (parsedInvitation.groupAlias?.trim()) {
        setStoredGroupAlias(groupId, parsedInvitation.groupAlias);
      }

      setStatus("syncing");
      setStatusMessage("Syncing workspace data...");

      await groupApi.syncGroup(groupId);

      setStatus("discovering-contexts");
      setStatusMessage("Loading workspace channels...");
      const contextsResult = await groupApi.listGroupContexts(groupId);
      if (contextsResult.error || !contextsResult.data) {
        throw new Error(
          contextsResult.error?.message || "Failed to list workspace channels",
        );
      }

      const contextEntries = contextsResult.data;

      if (contextEntries.length > 0) {
        setStatus("syncing-context");
        setStatusMessage(`Joining ${contextEntries.length} channel(s)...`);

        for (const entry of contextEntries) {
          try {
            const joinCtxResult = await groupApi.joinGroupContext(groupId, {
              contextId: entry.contextId,
            });
            if (joinCtxResult.data?.memberPublicKey) {
              setContextMemberIdentity(entry.contextId, joinCtxResult.data.memberPublicKey);
            }
          } catch {
            // Best-effort: failing to join one context shouldn't block workspace entry
          }
        }
      }

      setStatusMessage(
        contextEntries.length > 0
          ? "Workspace joined. Choose a channel next."
          : "Workspace joined. No channels are available yet.",
      );
      clearInvitationFromStorage();
      onSuccess();
    },
    [onSuccess],
  );

  const waitForContextSync = useCallback(
    (contextId: string) =>
      new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 60;

        syncIntervalRef.current = setInterval(async () => {
          attempts++;
          if (attempts > maxAttempts) {
            if (syncIntervalRef.current)
              clearInterval(syncIntervalRef.current);
            reject(
              new Error("Context sync timeout — please try again later"),
            );
            return;
          }

          try {
            const verifyResponse = await apiClient
              .node()
              .getContext(contextId);
            if (verifyResponse.data) {
              const isSynced =
                verifyResponse.data.rootHash !==
                "11111111111111111111111111111111";
              if (isSynced) {
                if (syncIntervalRef.current)
                  clearInterval(syncIntervalRef.current);
                clearInvitationFromStorage();
                onSuccess();
                resolve();
              }
            }
          } catch (err) {
            console.error("Error checking sync status:", err);
          }
        }, 3000);
      }).catch((error) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Sync failed",
        );
        setStatus("error");
      }),
    [onSuccess],
  );

  const joinContextFlow = useCallback(
    async (invitationPayload: string) => {
      setStatus("joining");
      setStatusMessage("Creating identity...");

      const identityResponse: ResponseData<NodeIdentity> = await apiClient
        .node()
        .createNewIdentity();
      if (identityResponse.error || !identityResponse.data) {
        throw new Error(
          identityResponse.error?.message ||
            "Failed to create identity for invitation",
        );
      }

      const identityPayload = identityResponse.data as
        | NodeIdentity
        | { data?: NodeIdentity };
      const identityData: NodeIdentity =
        "data" in identityPayload && identityPayload.data
          ? identityPayload.data
          : (identityPayload as NodeIdentity);
      const executorPk: string = identityData.publicKey;

      setStatusMessage("Joining context...");

      const parsed = JSON.parse(invitationPayload.trim());
      const signedInvitation: SignedOpenInvitation = parsed.data ?? parsed;

      const joinResponse: ResponseData<JoinContextResponse> = await apiClient
        .node()
        .joinContextByOpenInvitation(signedInvitation, executorPk);
      if (joinResponse.error || !joinResponse.data) {
        throw new Error(
          joinResponse.error?.message || "Failed to join context",
        );
      }

      const verifyResponse = await apiClient
        .node()
        .getContext(joinResponse.data.contextId);
      if (verifyResponse.error || !verifyResponse.data) {
        throw new Error("Failed to verify context");
      }

      localStorage.setItem(
        "new-context-identity",
        JSON.stringify(identityData),
      );
      setContextId(joinResponse.data.contextId);
      setExecutorPublicKey(executorPk);

      setStatus("syncing-context");
      setStatusMessage("Waiting for context to sync...");

      await waitForContextSync(joinResponse.data.contextId);
    },
    [waitForContextSync],
  );

  const processInvitation = useCallback(async () => {
    if (hasAttemptedJoin.current) return;
    hasAttemptedJoin.current = true;

    try {
      const invitationPayload = getInvitationFromStorage();
      if (!invitationPayload) {
        setErrorMessage("No invitation found");
        setStatus("error");
        return;
      }

      if (isGroupInvitation(invitationPayload)) {
        await joinGroupFlow(invitationPayload);
      } else {
        await joinContextFlow(invitationPayload);
      }
    } catch (error) {
      console.error("Invitation join error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
      setStatus("error");
    }
  }, [joinGroupFlow, joinContextFlow]);

  useEffect(() => {
    processInvitation();
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [processInvitation]);

  const handleRetry = () => {
    hasAttemptedJoin.current = false;
    setErrorMessage("");
    setStatus("joining");
    processInvitation();
  };

  const handleCancel = () => {
    clearInvitationFromStorage();
    onError();
  };

  return (
    <Overlay>
      <PopupContainer>
        {status !== "error" && (
          <>
            <Title>
              {status === "joining"
                ? "Joining..."
                : status === "syncing"
                  ? "Syncing workspace..."
                  : status === "discovering-contexts"
                    ? "Loading channels..."
                    : "Syncing channel..."}
            </Title>
            <Message $type="info">{statusMessage}</Message>
          </>
        )}

        {status === "error" && (
          <>
            <Title>Join Failed</Title>
            <Message $type="error">{errorMessage}</Message>
            <ButtonGroup>
              <Button
                onClick={handleRetry}
                variant="primary"
                style={{ flex: 1 }}
              >
                Retry
              </Button>
              <Button
                onClick={handleCancel}
                variant="secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
            </ButtonGroup>
          </>
        )}
      </PopupContainer>
    </Overlay>
  );
}
