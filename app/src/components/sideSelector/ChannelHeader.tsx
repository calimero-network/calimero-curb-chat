import { styled } from "styled-components";
import CreateChannelPopup from "../popups/CreateChannelPopup";
import { isValidChannelName } from "../../utils/validation";
import { ContextApiDataSource } from "../../api/dataSource/nodeApiDataSource";
import { GroupApiDataSource } from "../../api/dataSource/groupApiDataSource";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
import { getApplicationId, getGroupId, setContextMemberIdentity } from "../../constants/config";
import { memo, useCallback, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { log } from "../../utils/logger";
import {
  getChannelVisibilityOption,
} from "../../utils/channelVisibility";
import { buildChannelEntryChat } from "../../utils/channelEntry";
import { getMessengerDisplayName } from "../../utils/messengerName";
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
  existingChannelNames?: string[];
  targetGroupId?: string;
}

const ChannelHeader = memo(function ChannelHeader(props: ChannelHeaderProps) {
  const [isOpen, setIsOpen] = usePersistentState("createChannelModalOpen", false);
  const [inputValue, setInputValue] = usePersistentState("createChannelInputValue", "");
  const [defaultVisibility, setDefaultVisibility] = useState<"public" | "private">("public");
  const [isLoadingDefaultVisibility, setIsLoadingDefaultVisibility] = useState(false);
  const groupId = getGroupId();

  const channelNameValidator = useCallback(
    (value: string) => {
      const base = isValidChannelName(value);
      if (!base.isValid) return base;
      const lower = value.toLowerCase();
      const isDuplicate = (props.existingChannelNames ?? []).some(
        (n) => n.toLowerCase() === lower,
      );
      if (isDuplicate) return { isValid: false, error: "A channel with this name already exists" };
      return { isValid: true, error: "" };
    },
    [props.existingChannelNames],
  );

  const createChannel = async (
    channelName: string,
    isPublic: boolean,
    _isReadOnly: boolean,
  ) => {
    if (!groupId) {
      log.error("ChannelHeader", "No groupId configured — cannot create channel");
      return;
    }

    const lower = channelName.toLowerCase();
    const isDuplicate = (props.existingChannelNames ?? []).some(
      (n) => n.toLowerCase() === lower,
    );
    if (isDuplicate) {
      log.warn("ChannelHeader", `Channel name "${channelName}" already exists`);
      return;
    }

    const nodeApi = new ContextApiDataSource();

    // Create context directly in the namespace group — subgroup creation requires
    // namespace admin rights which regular members don't have.
    const contextGroupId = props.targetGroupId ?? groupId;

    const createResp = await nodeApi.createGroupContext({
      applicationId: getApplicationId(),
      protocol: "near",
      groupId: contextGroupId,
      alias: channelName,
      initializationParams: {
        name: channelName,
        context_type: "Channel",
        description: "",
        created_at: Math.floor(Date.now() / 1000),
      },
    });

    if (createResp.error || !createResp.data) {
      log.error("ChannelHeader", "Failed to create channel context", createResp.error);
      return;
    }

    const contextId = createResp.data.contextId;
    const memberKey = createResp.data.memberPublicKey ?? "";
    if (memberKey) {
      setContextMemberIdentity(contextId, memberKey);
      const username = getMessengerDisplayName();
      if (username) {
        new ClientApiDataSource()
          .joinChat({ contextId, executorPublicKey: memberKey, username })
          .catch((e) => log.warn("ChannelHeader", "set_profile failed on new channel", e));
      }
    }

    setInputValue("");
    setIsOpen(false);

    if (memberKey) {
      props.onChannelSelected?.(
        buildChannelEntryChat({ contextId, name: channelName, contextIdentity: memberKey }),
      );
    }
    props.onChannelCreated?.();
  };

  const prepareCreateChannelModal = useCallback(async () => {
    const targetGroupId = props.targetGroupId ?? groupId;
    if (!targetGroupId || isLoadingDefaultVisibility) {
      return;
    }

    setIsLoadingDefaultVisibility(true);
    const groupApi = new GroupApiDataSource();
    const groupResp = await groupApi.getGroup(targetGroupId);

    if (groupResp.data?.subgroupVisibility) {
      setDefaultVisibility(getChannelVisibilityOption(groupResp.data.subgroupVisibility));
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
      {(props.targetGroupId ?? groupId) && (
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
          channelNameValidator={channelNameValidator}
          defaultVisibility={defaultVisibility}
        />
      )}
    </Container>
  );
});

export default ChannelHeader;
