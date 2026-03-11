import { useState, useCallback } from "react";
import { styled } from "styled-components";
import { Button, Input } from "@calimero-network/mero-ui";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import { ContextApiDataSource } from "../../api/dataSource/nodeApiDataSource";
import { getApplicationId, setGroupId } from "../../constants/config";
import {
  generateInvitationUrl,
  generateInvitationDeepLink,
} from "../../utils/invitation";

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
  max-width: 480px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
`;

const Title = styled.h2`
  color: #ffffff;
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-align: center;
`;

const Subtitle = styled.p`
  color: #b8b8d1;
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 1.5rem;
`;

const StepIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const StepDot = styled.div<{ $active: boolean; $done: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $active, $done }) =>
    $done ? "#27ae60" : $active ? "#7c3aed" : "rgba(255, 255, 255, 0.15)"};
  transition: background 0.2s;
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

const InviteLinkBox = styled.div`
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  word-break: break-all;
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 0.75rem;
  color: #b8b8d1;
  max-height: 120px;
  overflow-y: auto;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
`;

const Label = styled.label`
  font-size: 0.75rem;
  font-weight: 500;
  color: #b8b8d1;
`;

type Step = "form" | "creating" | "invite" | "error";

interface CreateWorkspacePopupProps {
  onSuccess: (groupId: string) => void;
  onCancel: () => void;
}

export default function CreateWorkspacePopup({
  onSuccess,
  onCancel,
}: CreateWorkspacePopupProps) {
  const [step, setStep] = useState<Step>("form");
  const [workspaceName, setWorkspaceName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [invitePayload, setInvitePayload] = useState("");
  const [createdGroupId, setCreatedGroupId] = useState("");
  const [copied, setCopied] = useState(false);

  const stepsCompleted = step === "form" ? 0 : step === "creating" ? 1 : step === "invite" ? 3 : 0;

  const createWorkspace = useCallback(async () => {
    setStep("creating");
    setErrorMessage("");

    const groupApi = new GroupApiDataSource();
    const nodeApi = new ContextApiDataSource();
    const applicationId = getApplicationId();

    try {
      const groupResult = await groupApi.createGroup({ applicationId });
      if (groupResult.error || !groupResult.data) {
        throw new Error(groupResult.error?.message || "Failed to create group");
      }
      const groupId = groupResult.data.groupId;
      setCreatedGroupId(groupId);
      setGroupId(groupId);

      const contextResult = await nodeApi.createGroupContext({
        applicationId,
        protocol: "near",
        groupId,
        initializationParams: {
          name: workspaceName.trim() || "general",
          type: "channel",
          description: "Default channel",
          created_at: Date.now(),
        },
      });
      if (contextResult.error || !contextResult.data) {
        throw new Error(
          contextResult.error?.message || "Failed to create default channel",
        );
      }

      const inviteResult = await groupApi.createInvitation(groupId);
      if (inviteResult.error || !inviteResult.data) {
        throw new Error(
          inviteResult.error?.message || "Failed to create invitation",
        );
      }
      setInvitePayload(inviteResult.data.payload);
      setStep("invite");
    } catch (error) {
      console.error("Create workspace failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
      setStep("error");
    }
  }, [workspaceName]);

  const handleCopyWebLink = async () => {
    try {
      const url = generateInvitationUrl(invitePayload);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const url = generateInvitationUrl(invitePayload);
      prompt("Copy this invite link:", url);
    }
  };

  const handleCopyDesktopLink = async () => {
    try {
      const url = generateInvitationDeepLink(invitePayload);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const url = generateInvitationDeepLink(invitePayload);
      prompt("Copy this invite link:", url);
    }
  };

  const handleDone = () => {
    onSuccess(createdGroupId);
  };

  return (
    <Overlay>
      <PopupContainer>
        <StepIndicator>
          <StepDot $active={step === "form"} $done={stepsCompleted > 0} />
          <StepDot $active={step === "creating"} $done={stepsCompleted > 1} />
          <StepDot $active={step === "invite"} $done={stepsCompleted > 2} />
        </StepIndicator>

        {step === "form" && (
          <>
            <Title>Create Workspace</Title>
            <Subtitle>
              Set up a new workspace with a default #general channel.
              You can invite members after creation.
            </Subtitle>
            <FormGroup>
              <Label>Workspace name (first channel)</Label>
              <Input
                type="text"
                placeholder="e.g. general"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                autoFocus
              />
            </FormGroup>
            <ButtonGroup>
              <Button
                onClick={createWorkspace}
                variant="primary"
                style={{ flex: 1 }}
              >
                Create workspace
              </Button>
              <Button onClick={onCancel} variant="secondary" style={{ flex: 1 }}>
                Cancel
              </Button>
            </ButtonGroup>
          </>
        )}

        {step === "creating" && (
          <>
            <Title>Creating workspace...</Title>
            <Message $type="info">
              Setting up your group, default channel, and invitation. Please wait.
            </Message>
          </>
        )}

        {step === "invite" && (
          <>
            <Title>Workspace created!</Title>
            <Message $type="success">
              Your workspace is ready. Share the invite link with members.
            </Message>
            <Label>Invite link (web)</Label>
            <InviteLinkBox>{generateInvitationUrl(invitePayload)}</InviteLinkBox>
            <ButtonGroup>
              <Button
                onClick={handleCopyWebLink}
                variant="secondary"
                style={{ flex: 1 }}
              >
                {copied ? "Copied!" : "Copy web link"}
              </Button>
              <Button
                onClick={handleCopyDesktopLink}
                variant="secondary"
                style={{ flex: 1 }}
              >
                Copy desktop link
              </Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button
                onClick={handleDone}
                variant="primary"
                style={{ flex: 1 }}
              >
                Done
              </Button>
            </ButtonGroup>
          </>
        )}

        {step === "error" && (
          <>
            <Title>Workspace Creation Failed</Title>
            <Message $type="error">{errorMessage}</Message>
            <ButtonGroup>
              <Button
                onClick={() => setStep("form")}
                variant="primary"
                style={{ flex: 1 }}
              >
                Try again
              </Button>
              <Button onClick={onCancel} variant="secondary" style={{ flex: 1 }}>
                Cancel
              </Button>
            </ButtonGroup>
          </>
        )}
      </PopupContainer>
    </Overlay>
  );
}
