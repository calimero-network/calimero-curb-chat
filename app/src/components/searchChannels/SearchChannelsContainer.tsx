import { styled } from "styled-components";
import Loader from "../loader/Loader";
import type { ActiveChat, ChannelMeta } from "../../types/Common";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiDataSource } from "../../api/dataSource/clientApiDataSource";
import { Button, SearchInput } from "@calimero-network/mero-ui";
import { ChannelType } from "../../api/clientApi";
import type { ChannelMember, ChannelDataResponse } from "../../api/clientApi";

const SearchContainer = styled.div`
  padding: 24px;
  display: flex;
  flex-direction: column;
  @media (min-width: 1025px) {
    height: 100%;
  }
  @media (max-width: 1024px) {
    padding: 42px 0 0;
    background-color: #0e0e10;
  }
  .inputFieldWrapper {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
    @media (max-width: 1024px) {
      margin-top: 24px;
      padding-left: 16px;
      padding-right: 16px;
    }
  }
  .searchInput {
    width: 100%;
    background-color: #070707;
    border: none;
    outline: 0;
    color: #fff;
    font-family: Helvetica Neue;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 150%;
    padding: 8px 16px;
    border-radius: 4px;
  }
  .searchIcon {
    fill: #777583;
    position: absolute;
    z-index: 10;
    right: 16px;
    top: 10px;
    cursor: pointer;
    :hover {
      fill: #fff;
    }
    @media (max-width: 1024px) {
      right: 32px;
    }
  }
  .channelListWrapper {
    padding-top: 24px;
    padding-left: 16px;
    padding-right: 16px;
    width: 100%;
    scrollbar-color: black transparent;
    ::-webkit-scrollbar {
      width: 0px;
    }
    ::-webkit-scrollbar-thumb {
      background-color: black;
      border-radius: 6px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background-color: black;
    }
    * {
      scrollbar-color: black transparent;
    }
    html::-webkit-scrollbar {
      width: 12px;
    }
    html::-webkit-scrollbar-thumb {
      background-color: black;
      border-radius: 6px;
    }
    html::-webkit-scrollbar-thumb:hover {
      background-color: black;
    }
    @media (max-width: 1024px) {
      padding-top: 16px;
      overflow: scroll;
      padding-bottom: 16px;
    }
    @media (min-width: 1025px) {
      height: 100%;
      overflow: scroll;
    }
  }
  .listHeader {
    width: 100%;
    color: #777583;
    font-family: Helvetica Neue;
    font-size: 14px;
    font-style: normal;
    font-weight: 700;
    line-height: 150%;
  }
  .list {
    width: 100%;
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    @media (min-width: 1025px) {
      height: 100%;
    }
    @media (max-width: 1024px) {
      flex: 1;
    }
  }
  .listItem {
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #141418;
    border-radius: 4px;
  }
  .channelNameText {
    color: #777583;
    font-family: Helvetica Neue;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 150%;
    padding-left: 6px;
  }
  .creatorText {
    color: #777583;
    font-family: Helvetica Neue;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 150%;
    padding-left: 4px;
  }
  .listItemOptions {
    display: flex;
    gap: 8px;
    font-family: Helvetica Neue;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 150%;
  }
  .viewChannelButton,
  .joinChannelButton {
    padding: 4px 13px;
    border-radius: 4px;
    width: 64px;
    cursor: pointer;
    text-align: center;
  }
  .viewChannelButton {
    color: #777583;
    border: 1px solid #141418;
    :hover {
      color: #fff;
      background-color: #070707;
      border: 1px solid #070707;
    }
  }
  .joinChannelButton {
    color: #fff;
    border: 1px solid #1e1f28;
  }
  .spinnerWrapper {
    margin-top: 4px;
  }
`;

interface SearchChannelsContainerProps {
  onChatSelected: (chat: ActiveChat) => void;
  fetchChannels: () => void;
}

export default function SearchChannelsContainer({
  onChatSelected,
  fetchChannels: refreshGlobalChannels,
}: SearchChannelsContainerProps) {
  const apiClient = useMemo(() => new ClientApiDataSource(), []);
  const [allChannels, setAllChannels] = useState<ChannelMeta[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingNameId, setIsLoadingNameId] = useState("");
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const lowerInput = inputValue.toLowerCase();
  const channelsStartingWithPrefix = lowerInput
    ? allChannels.filter((channel) =>
        channel.name.toLowerCase().startsWith(lowerInput),
      )
    : allChannels;

  const mapMembers = useCallback(
    (members: ChannelMember[] | undefined, isModerator = false) =>
      (members ?? []).map((member) => ({
        id: member.publicKey,
        name: member.username,
        moderator: isModerator,
        active: true,
      })),
    [],
  );

  const refreshDirectory = useCallback(async () => {
    setIsLoadingDirectory(true);
    setFetchError(null);
    try {
      const response = await apiClient.getAllChannelsSearch();
      if (response.data) {
        const defaultChannels = response.data;
        const joined = defaultChannels.joined ?? [];
        const available = defaultChannels.availablePublic ?? [];

        const convertChannel = (
          channel: ChannelDataResponse,
          isMember: boolean,
        ): ChannelMeta => ({
          name: channel.channelId,
          type: "channel",
          channelType: channel.type,
          description: "",
          members: mapMembers(channel.members, false),
          moderators: mapMembers(channel.moderators, true),
          createdAt: channel.createdAt,
          createdBy: channel.createdBy,
          createdByUsername: channel.createdByUsername,
          owner: channel.createdBy,
          inviteOnly: channel.type === ChannelType.PRIVATE,
          unreadMessages: { count: 0, mentions: 0 },
          isMember,
          readOnly: channel.readOnly,
        });

        const aggregated: ChannelMeta[] = [
          ...joined.map((channel) => convertChannel(channel, true)),
          ...available.map((channel) => convertChannel(channel, false)),
        ];

    

        setAllChannels(aggregated);
      } else {
        setAllChannels([]);
        setFetchError(
          response.error?.message || "Failed to load channel directory",
        );
      }
    } catch (error) {
      console.error("SearchChannels", "Failed to load channel directory", error);
      setAllChannels([]);
      setFetchError("Failed to load channel directory");
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [apiClient, mapMembers]);

  useEffect(() => {
    refreshDirectory();
  }, [refreshDirectory]);

  const clickChannelOption = useCallback(
    async (isMember: boolean, channelName: string) => {
      setIsLoadingNameId(channelName);
      try {
        if (isMember) {
          await apiClient.leaveChannel({
            channel: { name: channelName },
          });
        } else {
          await apiClient.joinChannel({
            channel: { name: channelName },
          });
        }
        await refreshDirectory();
        refreshGlobalChannels();
      } finally {
        setIsLoadingNameId("");
      }
    },
    [apiClient, refreshDirectory, refreshGlobalChannels],
  );

  const onViewChannel = useCallback(
    (chatSelected: ChannelMeta) => {
      const chat: ActiveChat = {
        type: chatSelected.type,
        id: chatSelected.name,
        name: chatSelected.name,
        readOnly: chatSelected.readOnly,
        account: chatSelected.owner,
        canJoin: chatSelected.isMember === false,
      };
      onChatSelected(chat);
    },
    [onChatSelected],
  );

  return (
    <SearchContainer>
      <div className="inputFieldWrapper">
        <SearchInput
          label="Search Channels"
          style={{ width: "100%" }}
          onChange={(e) => setInputValue(e)}
          value={inputValue}
          placeholder="Search channels..."
          clearable={false}
          showSuggestions={false}
          showCategories={false}
        />
      </div>
      <div className="channelListWrapper">
        <div className="listHeader">Channel List</div>
        <div className="list">
          {isLoadingDirectory && allChannels.length === 0 && (
            <div className="spinnerWrapper">
              <Loader size={24} />
            </div>
          )}
          {!isLoadingDirectory &&
            fetchError &&
            allChannels.length === 0 && <div>{fetchError}</div>}
          {channelsStartingWithPrefix
            .filter((channel) => channel.name !== "")
            .map((channel: ChannelMeta, id: number) => (
              <div key={id} className="listItem">
                <div>
                  <div className="channelNameText">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="17"
                      viewBox="0 0 13 17"
                      fill="none"
                    >
                      <path
                        d="M6.585 15.972C6.57134 16.0614 6.56383 16.1516 6.5625 16.242C6.5625 16.6995 6.8775 17.004 7.3125 17.004C7.7115 17.004 8.0505 16.746 8.145 16.2885L8.976 12.234H10.782C11.4135 12.234 11.7075 11.883 11.7075 11.4135C11.7075 10.9455 11.4255 10.6185 10.782 10.6185H9.3045L10.0785 6.83249H11.976C12.621 6.83249 12.903 6.49199 12.903 6.01199C12.903 5.54249 12.621 5.22599 11.976 5.22599H10.407L11.121 1.76999C11.1354 1.68874 11.1434 1.60649 11.145 1.52399C11.1462 1.42202 11.127 1.32083 11.0885 1.22638C11.0501 1.13192 10.9931 1.04612 10.921 0.974005C10.8489 0.90189 10.7631 0.844923 10.6686 0.806453C10.5742 0.767984 10.473 0.748788 10.371 0.749995C10.1822 0.746392 9.99804 0.80888 9.8504 0.926656C9.70277 1.04443 9.60094 1.21009 9.5625 1.39499L8.778 5.22599H5.4255L6.141 1.76999C6.153 1.70999 6.1635 1.59299 6.1635 1.52399C6.16433 1.42123 6.14452 1.31935 6.10526 1.22438C6.06599 1.12941 6.00807 1.04329 5.93491 0.971112C5.86176 0.898937 5.77486 0.842178 5.67937 0.804196C5.58388 0.766214 5.48174 0.747784 5.379 0.749995C5.19215 0.748908 5.0107 0.812572 4.86549 0.930161C4.72028 1.04775 4.62028 1.212 4.5825 1.39499L3.795 5.22599H2.121C1.476 5.22599 1.1955 5.55599 1.1955 6.02399C1.1955 6.49199 1.476 6.83249 2.121 6.83249H3.48L2.7075 10.617H0.9135C0.282 10.617 0 10.9455 0 11.4135C0 11.883 0.282 12.234 0.915 12.234H2.379L1.605 15.972C1.593 16.032 1.5825 16.1595 1.5825 16.242C1.5825 16.6995 1.8975 17.004 2.3325 17.004C2.73 17.004 3.0705 16.746 3.1635 16.2885L3.996 12.234H7.359L6.5865 15.972H6.585ZM5.085 6.80849H8.484L7.7115 10.653H4.2885L5.0865 6.80849H5.085Z"
                        fill="#3B3B40"
                      />
                    </svg>
                    {channel.name}
                  </div>
                  <div className="creatorText">
                    Created by: {channel.createdByUsername}
                  </div>
                </div>
                <div className="listItemOptions">
                  {channel.name === isLoadingNameId && (
                    <div className="spinnerWrapper">
                      <Loader size={20} />
                    </div>
                  )}
                  <Button
                    className="viewChannelButton"
                    onClick={() => onViewChannel(channel)}
                    variant="secondary"
                    style={{ border: "none", backgroundColor: "transparent" }}
                  >
                    View
                  </Button>
                  <Button
                    disabled={
                      channel.name === isLoadingNameId ||
                      channel.createdBy === localStorage.getItem("accountId") ||
                      channel.channelType === "default"
                    }
                    variant={channel.isMember ? "secondary" : "primary"}
                    onClick={() =>
                      clickChannelOption(channel.isMember, channel.name)
                    }
                    style={{ width: "74px" }}
                  >
                    {channel.isMember ? "Leave" : "Join"}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </SearchContainer>
  );
}
