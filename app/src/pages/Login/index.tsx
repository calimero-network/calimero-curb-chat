import { CalimeroConnectButton } from "@calimero-network/calimero-client";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { styled } from "styled-components";

const LoginWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0e0e10;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

const LoginCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
  font-weight: 600;
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  font-weight: 500;
  color: #555;
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  font-size: 0.9rem;
  text-align: center;
  margin-top: 0.5rem;
`;

export default function Login() {
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get("error");

  useEffect(() => {
    if (errorMessage) {
      setError(errorMessage);
    }
  }, [errorMessage]);

  return (
    <LoginWrapper>
      <LoginCard>
        <Title>Welcome to Curb Chat</Title>
        <Wrapper>
          <Subtitle>Connect your node to start using the chat</Subtitle>
          <CalimeroConnectButton />
        </Wrapper>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </LoginCard>
    </LoginWrapper>
  );
}
