import { useCallback, useState } from "react";
import { styled } from "styled-components";
import { Button, Input } from "@calimero-network/mero-ui";
import type { ActiveChat } from "../types/Common";
import { ClientApiDataSource } from "../api/dataSource/clientApiDataSource";
import { StorageHelper } from "../utils/storage";
import { setCachedUsernameForIdentity } from "../utils/chatProfileCache";

const Wrapper = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Card = styled.div`
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  border-radius: 12px;
  background: #141418;
  border: 1px solid rgba(255, 255, 255, 0.08);
`;

const Title = styled.h2`
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
`;

const Description = styled.p`
  margin: 0;
  color: #b8b8d1;
  font-size: 0.85rem;
  line-height: 1.5;
`;

const ErrorText = styled.p`
  margin: 0;
  color: #e74c3c;
  font-size: 0.8rem;
`;

interface ChannelProfileSetupProps {
  activeChat: ActiveChat;
  onCompleted: () => void;
}

export default function ChannelProfileSetup({
  activeChat,
  onCompleted,
}: ChannelProfileSetupProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError("Enter a username to start chatting in this channel.");
      return;
    }

    if (!activeChat.contextId || !activeChat.contextIdentity) {
      setError("Channel identity is missing. Rejoin this channel from Browse Channels.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await new ClientApiDataSource().joinChat({
        contextId: activeChat.contextId,
        executorPublicKey: activeChat.contextIdentity,
        username: trimmedUsername,
      });

      if (response.error) {
        setError(response.error.message || "Failed to save username");
        return;
      }

      StorageHelper.setItem("chat-username", trimmedUsername);
      setCachedUsernameForIdentity(activeChat.contextIdentity, trimmedUsername);
      onCompleted();
    } finally {
      setSubmitting(false);
    }
  }, [activeChat.contextId, activeChat.contextIdentity, onCompleted, username]);

  return (
    <Wrapper>
      <Card>
        <Title>Complete channel entry</Title>
        <Description>
          This workspace identity has joined <strong>{activeChat.name}</strong>,
          but it still needs a chat profile before messages can be sent.
        </Description>
        <Input
          id="channelProfileUsername"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setError("");
          }}
          disabled={submitting}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={submitting || !username.trim()}
        >
          {submitting ? "Saving..." : "Continue to chat"}
        </Button>
      </Card>
    </Wrapper>
  );
}
