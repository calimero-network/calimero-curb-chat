import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { styled } from "styled-components";
import { getAppEndpointKey } from "@calimero-network/calimero-client";
import { Button, Input } from "@calimero-network/mero-ui";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import type { GroupSummary } from "../../api/groupApi";
import { clearStoredSession } from "../../utils/session";
import {
  parseGroupInvitationPayload,
  parseInvitationInput,
} from "../../utils/invitation";
import {
  getGroupMemberIdentity,
  getGroupId,
  setGroupId,
  setGroupMemberIdentity,
} from "../../constants/config";
import {
  getMessengerDisplayName,
  setMessengerDisplayName,
} from "../../utils/messengerName";

const TabContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  max-width: 400px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const Label = styled.label`
  font-size: 0.7rem;
  font-weight: 500;
  color: #b8b8d1;
`;

const Note = styled.p`
  font-size: 0.6rem;
  color: #b8b8d1;
  margin-top: 0.2rem;
`;

const Select = styled.select`
  appearance: none;
  -webkit-appearance: none;
  padding: 0.65rem 2.5rem 0.65rem 0.85rem;
  background-color: rgba(255, 255, 255, 0.06);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23b8b8d1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  width: 100%;

  &:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.22);
  }

  &:focus {
    outline: none;
    border-color: #7c3aed;
    background-color: rgba(255, 255, 255, 0.09);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  option {
    background: #18181c;
    color: #e8e8f0;
  }
`;

const Message = styled.div<{ type?: "success" | "error" | "info" }>`
  font-size: 0.7rem;
  text-align: center;
  color: ${({ type }) =>
    type === "success"
      ? "#27ae60"
      : type === "error"
        ? "#e74c3c"
        : type === "info"
          ? "#3b82f6"
          : "#b8b8d1"};
`;

interface ChatTabProps {
  isAuthenticated: boolean;
  isConfigSet: boolean;
  onInvitationSaved?: () => void;
}

function buildJoinedWorkspaceFallback(groupId: string): GroupSummary {
  return {
    groupId,
    appKey: "",
    targetApplicationId: "",
    upgradePolicy: "Automatic",
    createdAt: Math.floor(Date.now() / 1000),
  };
}

export default function ChatTab({
  isAuthenticated,
  isConfigSet,
  onInvitationSaved,
}: ChatTabProps) {
  const navigate = useNavigate();
  const [availableGroups, setAvailableGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(getGroupId());
  const [messengerName, setMessengerName] = useState(getMessengerDisplayName());
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invitationInput, setInvitationInput] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const [submittingInvitation, setSubmittingInvitation] = useState(false);
  const hasWorkspaces = availableGroups.length > 0;

  const fetchGroups = useCallback(async () => {
    if (!getAppEndpointKey()) {
      return;
    }

    setFetchingGroups(true);
    setError("");

    try {
      const response = await new GroupApiDataSource().listGroups();
      if (response.data && response.data.length > 0) {
        setAvailableGroups(response.data);
        const storedGroupId = getGroupId();
        const preferredGroup =
          response.data.find((group) => group.groupId === storedGroupId) ??
          response.data[0];
        setSelectedGroupId(preferredGroup.groupId);
      } else if (response.error) {
        setAvailableGroups([]);
        setSelectedGroupId("");
        setError(response.error.message || "Failed to fetch workspaces");
      } else {
        setAvailableGroups([]);
        setSelectedGroupId("");
      }
    } catch {
      setAvailableGroups([]);
      setSelectedGroupId("");
      setError("Failed to fetch workspaces from node");
    } finally {
      setFetchingGroups(false);
    }
  }, []);

  useEffect(() => {
    if ((isAuthenticated || isConfigSet) && getAppEndpointKey()) {
      fetchGroups();
    }
  }, [fetchGroups, isAuthenticated, isConfigSet]);

  const openWorkspace = useCallback(
    async (groupId: string) => {
      const trimmedMessengerName = messengerName.trim();

      if (!groupId || !trimmedMessengerName) {
        return;
      }

      setOpeningWorkspace(true);
      setError("");
      setSuccess("");

      try {
        const groupApi = new GroupApiDataSource();
        const identityResponse = await groupApi.resolveCurrentMemberIdentity(
          groupId,
          getGroupMemberIdentity(groupId),
        );

        if (identityResponse.error || !identityResponse.data) {
          throw new Error(
            identityResponse.error?.message || "Failed to resolve workspace identity",
          );
        }

        setGroupId(groupId);
        setMessengerDisplayName(trimmedMessengerName);
        setGroupMemberIdentity(groupId, identityResponse.data.memberIdentity);
        clearStoredSession();
        setSuccess("Workspace selected. Opening Browse Channels...");
        navigate("/");
      } catch (workspaceError) {
        setError(
          workspaceError instanceof Error
            ? workspaceError.message
            : "Failed to open workspace",
        );
      } finally {
        setOpeningWorkspace(false);
      }
    },
    [messengerName, navigate],
  );

  const handleWorkspaceChange = async (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const groupId = event.target.value;
    setSelectedGroupId(groupId);
    setSuccess(groupId ? "Workspace selected. Press Join chat to continue." : "");
    setError("");
  };

  const handleUseInvitation = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setInvitationError("");
    setSubmittingInvitation(true);

    const payload = parseInvitationInput(invitationInput);
    if (!payload) {
      setInvitationError(
        "Invalid invitation. Paste a full invite URL or the encoded invitation.",
      );
      setSubmittingInvitation(false);
      return;
    }

    void (async () => {
      try {
        const invitation = parseGroupInvitationPayload(payload);
        if (!invitation) {
          setInvitationError("This invitation is not a workspace invitation.");
          return;
        }

        const joinResponse = await new GroupApiDataSource().joinGroup({
          invitation,
        });
        if (joinResponse.error || !joinResponse.data) {
          setInvitationError(
            joinResponse.error?.message || "Failed to join workspace",
          );
          return;
        }

        setGroupMemberIdentity(
          joinResponse.data.groupId,
          joinResponse.data.memberIdentity,
        );
        setInvitationInput("");
        const previousGroups = availableGroups;
        await fetchGroups();
        setAvailableGroups((currentGroups) => {
          const groupsToKeep =
            currentGroups.length > 0 ? currentGroups : previousGroups;

          if (
            groupsToKeep.some(
              (group) => group.groupId === joinResponse.data.groupId,
            )
          ) {
            return groupsToKeep;
          }

          return [
            ...groupsToKeep,
            buildJoinedWorkspaceFallback(joinResponse.data.groupId),
          ];
        });
        setSelectedGroupId(joinResponse.data.groupId);
        setError("");
        onInvitationSaved?.();
        setSuccess("Workspace joined. Press Join chat to enter this workspace.");
      } catch {
        setInvitationError("Failed to join workspace from invitation.");
      } finally {
        setSubmittingInvitation(false);
      }
    })();
  };

  if (!getAppEndpointKey()) {
    return null;
  }

  return (
    <TabContent>
      <Form onSubmit={(event) => event.preventDefault()}>
        <InputGroup>
          <Label>Workspace</Label>
          <Select
            id="workspaceSelect"
            value={selectedGroupId}
            onChange={(event) => {
              void handleWorkspaceChange(event);
            }}
            disabled={fetchingGroups || openingWorkspace || availableGroups.length === 0}
          >
            <option value="">
              {fetchingGroups
                ? "Loading workspaces..."
                : availableGroups.length === 0
                  ? "No workspaces available"
                  : "Select a workspace..."}
            </option>
            {availableGroups.map((group) => (
              <option key={group.groupId} value={group.groupId}>
                {group.groupId.substring(0, 12)}...
              </option>
            ))}
          </Select>
          <Note>
            {openingWorkspace
              ? "Opening workspace..."
              : hasWorkspaces
                ? "Select a workspace, create one, or paste an invitation to join another workspace. Channel identity is resolved later when you join a channel."
                : "Create a new workspace or join one with an invitation."}
          </Note>
        </InputGroup>

        <InputGroup>
          <Label>Your name</Label>
          <Input
            id="messengerNameInput"
            type="text"
            placeholder="Enter your name"
            value={messengerName}
            onChange={(event) => {
              setMessengerName(event.target.value);
              setError("");
            }}
            disabled={openingWorkspace}
          />
          <Note>
            This name will be used across the app and auto-applied in every
            channel or DM you join.
          </Note>
        </InputGroup>

        {hasWorkspaces && (
          <Button
            type="button"
            variant="primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            onClick={() => {
              void openWorkspace(selectedGroupId);
            }}
            disabled={
              !selectedGroupId ||
              !messengerName.trim() ||
              fetchingGroups ||
              openingWorkspace
            }
          >
            {openingWorkspace ? "Joining..." : "Join chat"}
          </Button>
        )}

        <InputGroup>
          <Label>Join workspace with invitation</Label>
          <Note>
            {hasWorkspaces
              ? "Paste a workspace invite link or invitation payload to join another workspace."
              : "Paste a workspace invite link or invitation payload."}
          </Note>
          <Input
            id="invitationInput"
            type="text"
            placeholder="https://...?invitation=... or calimero://curb/join?invitation=... or paste encoded"
            value={invitationInput}
            onChange={(event) => {
              setInvitationInput(event.target.value);
              setInvitationError("");
            }}
            disabled={submittingInvitation}
          />
          <Button
            type="button"
            variant="primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            onClick={handleUseInvitation}
            disabled={submittingInvitation || !invitationInput.trim()}
          >
            {submittingInvitation ? "Using invitation..." : "Use invitation"}
          </Button>
          {invitationError && (
            <Message type="error">{invitationError}</Message>
          )}
        </InputGroup>

        {error && <Message type="error">{error}</Message>}
        {success && <Message type="success">{success}</Message>}
      </Form>
    </TabContent>
  );
}
