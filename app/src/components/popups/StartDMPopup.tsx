import { useEffect, useRef, useState, memo, useMemo } from "react";
import BaseModal from "../common/popups/BaseModal";
import Loader from "../loader/Loader";
import { styled } from "styled-components";
import type { UserId } from "../../api/clientApi";
import { usePersistentState } from "../../hooks/usePersistentState";
import { Button, Input } from "@calimero-network/mero-ui";

const SuggestionsDropdown = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border-radius: 4px;
  background-color: #0e0e10;
  position: absolute;
  top: 100%;
  width: 100%;
  z-index: 100;
`;

const SuggestionItem = styled.div`
  padding: 8px 16px;
  color: #fff;
  cursor: pointer;
  &:hover {
    background-color: #1f1f21;
  }
`;

const Text = styled.div`
  display: flex;
  column-gap: 0.5rem;
  align-items: center;
  color: #fff;
  font-family: Helvetica Neue;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 120%
  margin-bottom: 0.75rem;
`;

const customStyle = {
  border: "1px solid #dc3545",
  outline: "none",
};

const CloseButton = styled.div`
  color: #fff;
  :hover {
    color: #5765f2;
  }
  position: absolute;
  right: 1rem;
  cursor: pointer;
`;

const ErrorWrapper = styled.div`
  color: #dc3545;
  /* Body/Small */
  font-family: Helvetica Neue;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 150%; /* 18px */
  margin-top: 6px;
`;

const InputWrapper = styled.div`
  position: relative;
  margin-top: 0.5rem;
`;

export interface CreateContextResult {
  data: string;
  error: string;
}

type ChatMemberValue =
  | string
  | {
      userId?: UserId;
      username?: string;
    };

type ChatMembersSource =
  | Map<string, ChatMemberValue>
  | Record<string, ChatMemberValue>;

interface NormalizedChatMember {
  userId: UserId;
  username: string;
}

interface StartDMPopupProps {
  title: string;
  toggle: React.ReactNode;
  placeholder: string;
  buttonText: string;
  validator: (value: string) => { isValid: boolean; error: string };
  functionLoader: (value: string) => Promise<CreateContextResult>;
  chatMembers: ChatMembersSource;
}

const StartDMPopup = memo(function StartDMPopup({
  title,
  toggle,
  placeholder,
  buttonText,
  validator,
  functionLoader,
  chatMembers,
}: StartDMPopupProps) {
  const [isOpen, setIsOpen] = usePersistentState("startDMPopupOpen", false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = usePersistentState(
    "startDMInputValue",
    ""
  );
  const [validInput, setValidInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [suggestions, setSuggestions] = useState<NormalizedChatMember[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef("");

  const isInvalid = inputValue && !validInput && errorMessage;

  const normalizedMembers = useMemo<NormalizedChatMember[]>(() => {
    const mapEntryToNormalized = (
      userId: string,
      value: ChatMemberValue
    ): NormalizedChatMember => {
      if (typeof value === "string") {
        return {
          userId: userId as UserId,
          username: value,
        };
      }

      const derivedUserId = (value?.userId || userId) as UserId;
      return {
        userId: derivedUserId,
        username: value?.username || value?.userId || userId,
      };
    };

    if (!chatMembers) {
      return [];
    }

    if (chatMembers instanceof Map) {
      return Array.from(chatMembers.entries()).map(([userId, username]) =>
        mapEntryToNormalized(userId, username)
      );
    }

    return Object.entries(chatMembers).map(([userId, username]) =>
      mapEntryToNormalized(userId, username)
    );
  }, [chatMembers]);

  useEffect(() => {
    inputRef.current = inputValue;
  }, [inputValue]);

  const runProcess = async () => {
    setIsProcessing(true);
    setErrorMessage("");
    // inputValue is the username -> identity here

    const normalizedInput = inputValue.trim().toLowerCase();
    const matchedMember = normalizedMembers.find(
      (member) =>
        (typeof member.username === "string" &&
          member.username.toLowerCase() === normalizedInput) ||
        (typeof member.userId === "string" &&
          member.userId.toLowerCase() === normalizedInput)
    );

    if (!matchedMember) {
      setErrorMessage("User not found");
      setIsProcessing(false);
      return;
    }

    const result = await functionLoader(matchedMember.userId);
    if (result.data && !result.error) {
      // Only close popup on successful creation
      setIsProcessing(false);
      setInputValue(""); // Clear input on success
      setIsOpen(false);
    } else {
      // Keep popup open and show error message
      setErrorMessage(result.error || "Failed to create DM");
      setIsProcessing(false);
    }
  };

  const onOpenChange = (isOpen: boolean) => {
    if (isProcessing && !isOpen) {
      return;
    }
    // Only allow closing via the X button, not by clicking outside
    if (!isOpen) {
      return; // Prevent closing
    }
    setIsOpen(isOpen);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setErrorMessage("");
    if (value.length > 0) {
      const lowerValue = value.toLowerCase();
      const filteredSuggestions = normalizedMembers.filter(
        (member) =>
          (typeof member.username === "string" &&
            member.username.toLowerCase().startsWith(lowerValue)) ||
          (typeof member.userId === "string" &&
            member.userId.toLowerCase().startsWith(lowerValue))
      );
      setSuggestions(filteredSuggestions);
      setShowSuggestions(filteredSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }

    if (validator) {
      const { isValid, error } = validator(value);
      setValidInput(isValid);
      setErrorMessage(error ? error : "");
    }
  };

  const handleClosePopup = () => {
    if (isProcessing) return;
    setIsOpen(false);
  };

  const handleSuggestionClick = (suggestion: NormalizedChatMember) => {
    if (validator) {
      const { isValid, error } = validator(suggestion.username);
      setValidInput(isValid);
      setErrorMessage(error ? error : "");
    }
    setInputValue(suggestion.username);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const popupContent = (
    <div style={{ pointerEvents: "auto" }}>
      <CloseButton onClick={handleClosePopup}>
        <i className="bi bi-x-lg"></i>
      </CloseButton>
      <Text>{title}</Text>
      <InputWrapper>
        <Input
          onChange={handleInputChange}
          value={inputValue}
          placeholder={placeholder}
          style={isInvalid ? customStyle : {}}
        />
        {errorMessage && <ErrorWrapper>{errorMessage}</ErrorWrapper>}
        {showSuggestions && suggestions && suggestions.length > 0 && (
          <SuggestionsDropdown>
            {suggestions.map((suggestion) => (
              <SuggestionItem
                key={suggestion.userId}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion.username}
              </SuggestionItem>
            ))}
          </SuggestionsDropdown>
        )}
      </InputWrapper>
      <Button
        onClick={runProcess}
        disabled={(inputValue ? !!isInvalid : true) || isProcessing}
        style={{ width: "100%", marginTop: "1rem" }}
      >
        {isProcessing ? <Loader size={16} /> : buttonText}
      </Button>
    </div>
  );

  return (
    <BaseModal
      toggle={toggle}
      content={popupContent}
      open={isOpen}
      onOpenChange={onOpenChange}
      isChild={true}
    />
  );
});

export default StartDMPopup;
