import { useEffect, useMemo, useState } from "react";
import { styled } from "styled-components";
import { Button } from "@calimero-network/mero-ui";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import {
  generateInvitationDeepLink,
  generateInvitationUrl,
  serializeGroupInvitationPayload,
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

const Label = styled.label`
  font-size: 0.75rem;
  font-weight: 500;
  color: #b8b8d1;
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

interface GroupInviteModalProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  initialInvitationPayload?: string;
  title?: string;
  subtitle?: string;
  successMessage?: string;
  doneLabel?: string;
}

export default function GroupInviteModal({
  groupId,
  isOpen,
  onClose,
  initialInvitationPayload,
  title = "Invite people to workspace",
  subtitle = "Generate a workspace invitation and share it with people who should join this workspace.",
  successMessage = "Your workspace invitation is ready to share.",
  doneLabel = "Done",
}: GroupInviteModalProps) {
  const [invitationPayload, setInvitationPayload] = useState(
    initialInvitationPayload ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"web" | "desktop" | "">("");

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage("");
      setCopiedTarget("");
      return;
    }

    if (initialInvitationPayload) {
      setInvitationPayload(initialInvitationPayload);
      return;
    }

    if (!groupId) {
      setInvitationPayload("");
      return;
    }

    let cancelled = false;

    const loadInvitation = async () => {
      setLoading(true);
      setErrorMessage("");

      const response = await new GroupApiDataSource().createInvitation(groupId);

      if (cancelled) {
        return;
      }

      if (response.error || !response.data) {
        setInvitationPayload("");
        setErrorMessage(
          response.error?.message || "Failed to generate workspace invitation",
        );
        setLoading(false);
        return;
      }

      setInvitationPayload(
        serializeGroupInvitationPayload(response.data.invitation),
      );
      setLoading(false);
    };

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [groupId, initialInvitationPayload, isOpen]);

  const webUrl = useMemo(
    () => (invitationPayload ? generateInvitationUrl(invitationPayload) : ""),
    [invitationPayload],
  );
  const desktopUrl = useMemo(
    () =>
      invitationPayload
        ? generateInvitationDeepLink(invitationPayload)
        : "",
    [invitationPayload],
  );

  const handleCopy = async (target: "web" | "desktop") => {
    const value = target === "web" ? webUrl : desktopUrl;
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(""), 2000);
    } catch {
      prompt("Copy this invite link:", value);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Overlay>
      <PopupContainer>
        <Title>{title}</Title>
        <Subtitle>{subtitle}</Subtitle>

        {loading && (
          <Message $type="info">
            Generating a workspace invitation...
          </Message>
        )}

        {!loading && errorMessage && (
          <Message $type="error">{errorMessage}</Message>
        )}

        {!loading && invitationPayload && (
          <>
            <Message $type="success">{successMessage}</Message>
            <Label>Workspace link (web)</Label>
            <InviteLinkBox>{webUrl}</InviteLinkBox>
            <ButtonGroup>
              <Button
                onClick={() => handleCopy("web")}
                variant="secondary"
                style={{ flex: 1 }}
              >
                {copiedTarget === "web" ? "Copied!" : "Copy web link"}
              </Button>
              <Button
                onClick={() => handleCopy("desktop")}
                variant="secondary"
                style={{ flex: 1 }}
              >
                {copiedTarget === "desktop"
                  ? "Copied!"
                  : "Copy desktop link"}
              </Button>
            </ButtonGroup>
          </>
        )}

        <ButtonGroup>
          <Button onClick={onClose} variant="primary" style={{ flex: 1 }}>
            {doneLabel}
          </Button>
        </ButtonGroup>
      </PopupContainer>
    </Overlay>
  );
}
