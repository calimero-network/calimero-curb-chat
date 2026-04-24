import { styled } from "styled-components";
import CreateChannelPopup from "../popups/CreateChannelPopup";
import { isValidChannelName } from "../../utils/validation";
import { ContextApiDataSource } from "../../api/dataSource/nodeApiDataSource";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import { getApplicationId, getGroupId, setContextMemberIdentity } from "../../constants/config";
import { memo, useCallback, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useCurrentGroupPermissions } from "../../hooks/useCurrentGroupPermissions";
import { log } from "../../utils/logger";
import {
  getChannelVisibilityOption,
  getContextVisibilityModeFromOption,
} from "../../utils/channelVisibility";
import { buildChannelEntryChat } from "../../utils/channelEntry";
import type { ActiveChat } from "../../types/Common";

const Container = styled.div<{ $isCollapsed?: boolean }>`
  display: flex;
  justify-content: ${(props) => (props.$isCollapsed ? "center" : "space-between")};
  align-items: center;
  padding: 0.25rem 0.75rem 0.25rem ${(props) => (props.$isCollapsed ? "0.75rem" : "1rem")};
  margin-bottom: 0.125rem;
  @media (max-width: 1024px) {
    width: 100%;
    padding-top: 0.5rem;
  }
`;

const TextBold = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
`;

const PlusButton = styled.div`
  display: flex;
  cursor: pointer;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.25);
  transition: all 0.15s ease;

  &:hover {
    color: #a5ff11;
    background: rgba(165, 255, 17, 0.1);
  }

  svg {
    stroke: currentColor;
  }
`;

interface ChannelHeaderProps {
  title: string;
  isCollapsed?: boolean;
  onChannelCreated?: () => void;
  onChannelSelected?: (chat: ActiveChat) => void;
}

const ChannelHeader = memo(function ChannelHeader(props: ChannelHeaderProps) {
  const [isOpen, setIsOpen] = usePersistentState("createChannelModalOpen", false);
  const [inputValue, setInputValue] = usePersistentState("createChannelInputValue", "");
  const [defaultVisibility, setDefaultVisibility] = useState<"public" | "private">("public");
  const [isLoadingDefaultVisibility, setIsLoadingDefaultVisibility] = useState(false);
  const groupId = getGroupId();
  const { canCreateContext } = useCurrentGroupPermissions();

  const createChannel = async (
    channelName: string,
    isPublic: boolean,
    _isReadOnly: boolean,
  ) => {
    if (!groupId) {
      log.error("ChannelHeader", "No groupId configured — cannot create channel");
      return;
    }

    const nodeApi = new ContextApiDataSource();
    const initParams = {
      name: channelName,
      context_type: "Channel",
      description: "",
      created_at: Math.floor(Date.now() / 1000),
    };

    const createResp = await nodeApi.createGroupContext({
      applicationId: getApplicationId(),
      protocol: "near",
      groupId,
      alias: channelName,
      initializationParams: initParams,
    });

    if (createResp.error || !createResp.data) {
      log.error("ChannelHeader", "Failed to create channel context", createResp.error);
      return;
    }

    const contextId = createResp.data.contextId;
    if (createResp.data.memberPublicKey) {
      setContextMemberIdentity(contextId, createResp.data.memberPublicKey);
    }
    const groupApi = new GroupApiDataSource();
    const visibilityMode = getContextVisibilityModeFromOption(
      isPublic ? "public" : "private",
    );

    const visibilityResp = await groupApi.setContextVisibility(groupId, contextId, {
      mode: visibilityMode,
    });

    if (visibilityResp.error) {
      log.error(
        "ChannelHeader",
        `Failed to set channel visibility to ${visibilityMode}`,
        visibilityResp.error,
      );
    }

    setInputValue("");
    setIsOpen(false);

    const memberKey = createResp.data.memberPublicKey ?? "";
    if (memberKey) {
      props.onChannelSelected?.(
        buildChannelEntryChat({ contextId, name: channelName, contextIdentity: memberKey }),
      );
    }
    props.onChannelCreated?.();
  };

  const prepareCreateChannelModal = useCallback(async () => {
    if (!groupId || isLoadingDefaultVisibility) {
      return;
    }

    setIsLoadingDefaultVisibility(true);
    const groupApi = new GroupApiDataSource();
    const groupResp = await groupApi.getGroup(groupId);

    if (groupResp.data?.defaultVisibility) {
      setDefaultVisibility(getChannelVisibilityOption(groupResp.data.defaultVisibility));
    } else {
      setDefaultVisibility("public");
      if (groupResp.error) {
        log.error(
          "ChannelHeader",
          "Failed to read group default visibility, falling back to public",
          groupResp.error,
        );
      }
    }

    setIsLoadingDefaultVisibility(false);
    setIsOpen(true);
  }, [isLoadingDefaultVisibility, setIsOpen]);

  return (
    <Container $isCollapsed={props.isCollapsed}>
      {!props.isCollapsed && <TextBold>{props.title}</TextBold>}
      {groupId && canCreateContext && (
        <CreateChannelPopup
          title={"Create new Channel"}
          inputValue={inputValue}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          setInputValue={setInputValue}
          placeholder={"# channel name"}
          buttonText={"Create"}
          toggle={
            <PlusButton onClick={prepareCreateChannelModal}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </PlusButton>
          }
          createChannel={createChannel}
          channelNameValidator={isValidChannelName}
          defaultVisibility={defaultVisibility}
        />
      )}
    </Container>
  );
});

export default ChannelHeader;
