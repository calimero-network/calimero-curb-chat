import { useState } from "react";
import { styled } from "styled-components";
import { ContextApiDataSource } from "../../api/dataSource/nodeApiDataSource";
import { useNavigate } from "react-router-dom";

const PopupOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const PopupContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
`;

const Title = styled.h1`
  color: #333;
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 2px solid #f0f0f0;
  margin-bottom: 2rem;
`;

const Tab = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  color: ${props => props.active ? "#667eea" : "#666"};
  border-bottom: 3px solid ${props => props.active ? "#667eea" : "transparent"};
  transition: all 0.2s ease;

  &:hover {
    color: #667eea;
    background-color: #f8f9ff;
  }
`;

const TabContent = styled.div`
  min-height: 300px;
`;

const IdentityDisplay = styled.div`
  background: #f8f9ff;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
  text-align: center;
`;

const PublicKey = styled.div`
  font-family: monospace;
  font-size: 0.9rem;
  color: #333;
  background: white;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e1e5e9;
  margin: 1rem 0;
  word-break: break-all;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const CopyMessage = styled.div`
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.5rem;
`;

const Button = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0.5rem;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;



const BackButton = styled(Button)`
  background: #28a745;
  
  &:hover {
    background: #218838;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }

  &::placeholder {
    color: #999;
  }
`;

const Message = styled.div<{ type: "success" | "error" }>`
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  margin-top: 1rem;
  background-color: ${props => props.type === "success" ? "#d4edda" : "#f8d7da"};
  color: ${props => props.type === "success" ? "#155724" : "#721c24"};
  border: 1px solid ${props => props.type === "success" ? "#c3e6cb" : "#f5c6cb"};
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s ease-in-out infinite;
  margin-right: 0.5rem;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export default function ContextOperations() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [newIdentity, setNewIdentity] = useState<string>("");
  const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  
  const [joinContextData, setJoinContextData] = useState({
    invitationPayload: "",
  });
  const [inviteContextData, setInviteContextData] = useState({
    contextId: "",
    invitee: "",
    inviter: "",
  });

  const [joinContextStatus, setJoinContextStatus] = useState<{
    loading: boolean;
    message: string;
    type: "success" | "error";
  }>({ loading: false, message: "", type: "success" });

  const [inviteContextStatus, setInviteContextStatus] = useState<{
    loading: boolean;
    message: string;
    type: "success" | "error";
  }>({ loading: false, message: "", type: "success" });

  const handleCreateIdentity = async () => {
    setIsCreatingIdentity(true);
    try {
      const response = await new ContextApiDataSource().createIdentity();
      if (response.data) {
        const publicKey = response.data.publicKey;
        setNewIdentity(publicKey);
        // Save to localStorage
        localStorage.setItem("new-context-identity", publicKey);
      } else {
        console.error("Failed to create identity:", response.error);
      }
    } catch (error) {
      console.error("Error creating identity:", error);
    } finally {
      setIsCreatingIdentity(false);
    }
  };

  const handleCopyIdentity = async () => {
    if (newIdentity) {
      try {
        await navigator.clipboard.writeText(newIdentity);
        setCopyMessage("Copied to clipboard!");
        setTimeout(() => setCopyMessage(""), 2000);
      } catch (error) {
        console.error("Failed to copy:", error);
        setCopyMessage("Failed to copy");
        setTimeout(() => setCopyMessage(""), 2000);
      }
    }
  };

  const handleJoinContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinContextData.invitationPayload.trim()) {
      setJoinContextStatus({
        loading: false,
        message: "Invitation payload is required",
        type: "error"
      });
      return;
    }

    setJoinContextStatus({ loading: true, message: "", type: "success" });

    try {
      const response = await new ContextApiDataSource().joinContext({
        invitationPayload: joinContextData.invitationPayload.trim()
      });

      if (response.data) {
        setJoinContextStatus({
          loading: false,
          message: "Successfully joined context!",
          type: "success"
        });
        setJoinContextData({ invitationPayload: "" });
      } else {
        setJoinContextStatus({
          loading: false,
          message: response.error?.message || "Failed to join context",
          type: "error"
        });
      }
    } catch (error) {
      setJoinContextStatus({
        loading: false,
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        type: "error"
      });
    }
  };

  const handleInviteContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteContextData.contextId.trim() || !inviteContextData.invitee.trim() || !inviteContextData.inviter.trim()) {
      setInviteContextStatus({
        loading: false,
        message: "All fields are required",
        type: "error"
      });
      return;
    }

    setInviteContextStatus({ loading: true, message: "", type: "success" });

    try {
      const response = await new ContextApiDataSource().inviteToContext({
        contextId: inviteContextData.contextId.trim(),
        invitee: inviteContextData.invitee.trim(),
        inviter: inviteContextData.inviter.trim()
      });

      if (response.data) {
        setInviteContextStatus({
          loading: false,
          message: `Invitation sent successfully! Payload: ${response.data}`,
          type: "success"
        });
        setInviteContextData({ contextId: "", invitee: "", inviter: "" });
      } else {
        setInviteContextStatus({
          loading: false,
          message: response.error?.message || "Failed to send invitation",
          type: "error"
        });
      }
    } catch (error) {
      setInviteContextStatus({
        loading: false,
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        type: "error"
      });
    }
  };

  const handleBackToApp = () => {
    navigate("/");
  };

  const tabs = [
    { name: "Create Identity", id: 0 },
    { name: "Join Context", id: 1 },
    { name: "Invite to Context", id: 2 }
  ];

  return (
    <PopupOverlay>
      <PopupContainer>
        <Header>
          <Title>Context Operations</Title>
          <CloseButton onClick={handleBackToApp}>&times;</CloseButton>
        </Header>

        <TabContainer>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.name}
            </Tab>
          ))}
        </TabContainer>

        <TabContent>
          {activeTab === 0 && (
            <div>
              <h3>Create New Context Identity</h3>
              <p>Generate a new identity for your context operations.</p>
              
              {!newIdentity ? (
                <Button onClick={handleCreateIdentity} disabled={isCreatingIdentity}>
                  {isCreatingIdentity && <LoadingSpinner />}
                  {isCreatingIdentity ? "Creating..." : "Create New Identity"}
                </Button>
              ) : (
                <IdentityDisplay>
                  <h4>Your New Identity</h4>
                  <PublicKey onClick={handleCopyIdentity}>
                    {newIdentity}
                  </PublicKey>
                  <CopyMessage>
                    {copyMessage || "Click to copy"}
                  </CopyMessage>
                  <Button onClick={handleCreateIdentity} style={{ marginTop: "1rem" }}>
                    Create Another Identity
                  </Button>
                </IdentityDisplay>
              )}
            </div>
          )}

          {activeTab === 1 && (
            <div>
              <h3>Join Context</h3>
              <p>Join an existing context using an invitation payload.</p>
              
              <Form onSubmit={handleJoinContext}>
                <InputGroup>
                  <Label htmlFor="joinPayload">Invitation Payload</Label>
                  <Input
                    id="joinPayload"
                    type="text"
                    placeholder="Enter invitation payload"
                    value={joinContextData.invitationPayload}
                    onChange={(e) => setJoinContextData({ invitationPayload: e.target.value })}
                    disabled={joinContextStatus.loading}
                  />
                </InputGroup>
                <Button type="submit" disabled={joinContextStatus.loading}>
                  {joinContextStatus.loading && <LoadingSpinner />}
                  {joinContextStatus.loading ? "Joining..." : "Join Context"}
                </Button>
              </Form>
              
              {joinContextStatus.message && (
                <Message type={joinContextStatus.type}>
                  {joinContextStatus.message}
                </Message>
              )}
            </div>
          )}

          {activeTab === 2 && (
            <div>
              <h3>Invite to Context</h3>
              <p>Send an invitation to join a context.</p>
              
              <Form onSubmit={handleInviteContext}>
                <InputGroup>
                  <Label htmlFor="inviteContextId">Context ID</Label>
                  <Input
                    id="inviteContextId"
                    type="text"
                    placeholder="Enter context ID"
                    value={inviteContextData.contextId}
                    onChange={(e) => setInviteContextData({ ...inviteContextData, contextId: e.target.value })}
                    disabled={inviteContextStatus.loading}
                  />
                </InputGroup>
                <InputGroup>
                  <Label htmlFor="invitee">Invitee User ID</Label>
                  <Input
                    id="invitee"
                    type="text"
                    placeholder="Enter invitee user ID"
                    value={inviteContextData.invitee}
                    onChange={(e) => setInviteContextData({ ...inviteContextData, invitee: e.target.value })}
                    disabled={inviteContextStatus.loading}
                  />
                </InputGroup>
                <InputGroup>
                  <Label htmlFor="inviter">Inviter User ID</Label>
                  <Input
                    id="inviter"
                    type="text"
                    placeholder="Enter inviter user ID"
                    value={inviteContextData.inviter}
                    onChange={(e) => setInviteContextData({ ...inviteContextData, inviter: e.target.value })}
                    disabled={inviteContextStatus.loading}
                  />
                </InputGroup>
                <Button type="submit" disabled={inviteContextStatus.loading}>
                  {inviteContextStatus.loading && <LoadingSpinner />}
                  {inviteContextStatus.loading ? "Inviting..." : "Send Invitation"}
                </Button>
              </Form>
              
              {inviteContextStatus.message && (
                <Message type={inviteContextStatus.type}>
                  {inviteContextStatus.message}
                </Message>
              )}
            </div>
          )}
        </TabContent>

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <BackButton onClick={handleBackToApp}>
            Back to Application
          </BackButton>
        </div>
      </PopupContainer>
    </PopupOverlay>
  );
}