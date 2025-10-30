import React, { useState, useEffect } from "react";
import { styled } from "styled-components";
import {
  apiClient,
  getContextId,
  getExecutorPublicKey,
} from "@calimero-network/calimero-client";
import type { ResponseData } from "@calimero-network/calimero-client";
import { Button, Input } from "@calimero-network/mero-ui";
import type { ContextInviteByOpenInvitationResponse } from "@calimero-network/calimero-client/lib/api/nodeApi";

const TabContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Label = styled.label`
  font-size: 0.7rem;
  font-weight: 500;
  color: #b8b8d1;
`;

const Message = styled.div<{ type?: "success" | "error" }>`
  padding: 0.6rem;
  border-radius: 6px;
  font-size: 0.8rem;
  text-align: center;
  color: ${({ type }) =>
    type === "success" ? "#27ae60" : type === "error" ? "#e74c3c" : "#b8b8d1"};
`;

const ConfigInfo = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
`;

const ConfigTitle = styled.h4`
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

export default function InviteToContextTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [configData, setConfigData] = useState({
    contextId: "",
    executorPublicKey: "",
  });
  const [invitation, setInvitation] = useState<string | null>(null);

  useEffect(() => {
    const storedContextId = getContextId();
    const storedExecutorPublicKey = getExecutorPublicKey();

    if (storedContextId && storedExecutorPublicKey) {
      setConfigData({
        contextId: storedContextId,
        executorPublicKey: storedExecutorPublicKey,
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configData.contextId || !configData.executorPublicKey) {
      setMessage({
        text: "Context configuration not found. Please set up context first.",
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response: ResponseData<ContextInviteByOpenInvitationResponse> =
        await apiClient
          .node()
          .contextInviteByOpenInvitation(
            configData.contextId,
            configData.executorPublicKey,
            86400
          );

      console.log(response.data);
      if (response.error) {
        setMessage({
          text: response.error.message || "Failed to generate invitation",
          type: "error",
        });
      } else {
        setInvitation(JSON.stringify(response.data));
        setMessage({
          text: "Successfully generated invitation!",
          type: "success",
        });
      }
    } catch (_error) {
      setMessage({
        text: "An error occurred while generation invitation for context",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ text: "Copied to clipboard!", type: "success" });
      setTimeout(() => setMessage(null), 2000);
    } catch (_error) {
      setMessage({ text: "Failed to copy to clipboard", type: "error" });
    }
  };

  return (
    <TabContent>
      {invitation ? (
        <ConfigInfo>
          <ConfigTitle>Invitation</ConfigTitle>
          <InputGroup>
            <Label>Generated Invitation</Label>
            <Input
              id="invitationPayload"
              type="text"
              value={invitation}
              disabled={true}
            />
            <Button
              onClick={() => handleCopyToClipboard(invitation)}
              variant="secondary"
              style={{
                width: "80px",
                minWidth: "80px",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span>Copy</span>
            </Button>
          </InputGroup>
        </ConfigInfo>
      ) : (
        <ConfigInfo>
          <ConfigTitle>Context Configuration</ConfigTitle>
          <InputGroup>
            <Label>Context ID</Label>
            <Input
              id="contextId"
              type="text"
              value={configData.contextId ?? "Not found in localStorage"}
              disabled={true}
            />
          </InputGroup>
          <InputGroup>
            <Label>Executor Public Key</Label>
            <Input
              id="executorPublicKey"
              type="text"
              value={
                configData.executorPublicKey ?? "Not found in localStorage"
              }
              disabled={true}
            />
          </InputGroup>
        </ConfigInfo>
      )}

      <Form onSubmit={handleSubmit}>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "creating..." : "Create Invitation"}
        </Button>

        {message && <Message type={message.type}>{message.text}</Message>}
      </Form>
    </TabContent>
  );
}
