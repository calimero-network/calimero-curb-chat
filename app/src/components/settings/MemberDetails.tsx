import React, { useCallback, useState } from "react";
import styled from "styled-components";
import type { User } from "../../types/Common";
import MultipleInputPopup from "../common/popups/MultipleInputPopup";
import { Avatar } from "@calimero-network/mero-ui";
import type { UserId } from "../../api/clientApi";

const AddMemberButton = styled.div`
  display: flex;
  column-gap: 0.5rem;
  padding-left: 1rem;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  color: #fff;
  :hover {
    background-color: #5765f2;
  }
  border-radius: 4px;
  font-family: Helvetica Neue;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 150%;
  cursor: pointer;
`;

const UserListItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #777583;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  padding-left: 1rem;
  padding-right: 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
`;

const UserList = styled.div`
  overflow-y: scroll;
  max-height: 24rem;
  @media (max-width: 1024px) {
    max-height: 12rem;
  }
  scrollbar-color: black black;
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-thumb {
    background-color: black;
    border-radius: 6px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: black;
  }
  * {
    scrollbar-color: black black;
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
`;

const UserInfo = styled.div`
  display: flex;
  column-gap: 0.5rem;
  :hover {
    background-color: transparent;
  }
`;

const Text = styled.div<{ $isSelected?: boolean }>`
  display: flex;
  justify-content: start;
  align-items: center;
  width: 100%;
  color: ${({ $isSelected }) => ($isSelected ? "#8AA200" : "#fff")};
  font-family: Helvetica Neue;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 150%;
  :hover {
    background-color: transparent;
  }
`;

// const RoleText = styled.div`
//   color: #777583;
//   font-family: Helvetica Neue;
//   font-size: 12px;
//   font-style: normal;
//   font-weight: 700;
//   line-height: 100%;
// `;

// const ModeratorOptions = styled.div`
//   display: flex;
//   justify-content: center;
//   align-items: center;
//   gap: 12px;
// `;

// const OptionsButton = ({ handleClick }: { handleClick: () => void }) => {
//   return (
//     <div onClick={handleClick}>
//       <svg
//         xmlns="http://www.w3.org/2000/svg"
//         width="18"
//         height="18"
//         fill="white"
//         className="bi bi-three-dots"
//         viewBox="0 0 16 16"
//       >
//         <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
//       </svg>
//     </div>
//   );
// };

// const OptionsWindow = styled.div`
//   width: 252px;
//   display: flex;
//   flex-direction: column;
//   padding-top: 4px;
//   padding-bottom: 4px;
//   border-radius: 4px;
//   background-color: #25252a;
//   pointer-events: auto;
// `;

// const Option = styled.div`
//   color: #fff;
//   font-family: Helvetica Neue;
//   font-size: 16px;
//   font-style: normal;
//   padding-left: 1rem;
//   padding-right: 1rem;
//   padding-top: 4px;
//   padding-bottom: 4px;
//   font-weight: 400;
//   line-height: 150%;
//   -webkit-font-smoothing: antialiased applied;
//   cursor: pointer;

//   :hover {
//     background-color: #2a2b37;
//   }
// `;

const OverLay = styled.div`
  position: fixed;
  z-index: 10;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
`;

// const TopOverlay = styled.div<{ bottomPadding: boolean }>`
//   position: fixed;
//   z-index: 20;
//   @media (max-width: 1024px) {
//     position: absolute;
//     right: 0;
//     ${({ bottomPadding }) =>
//       bottomPadding
//         ? `
//       bottom: 100%;
//     `
//         : `
//       top: 100%;
//     `}
//   }
// `;

interface AddUserDialogProps {
  addMember: (account: string, channel: string, username?: string) => void;
  channelName: string;
  getNonInvitedUsers: (value: string) => UserId[];
  nonInvitedUserList: Record<string, string>;
}

const AddUserDialog = ({
  addMember,
  channelName,
  getNonInvitedUsers,
  nonInvitedUserList,
}: AddUserDialogProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const addUser = useCallback(() => {
    selectedUsers.forEach((account) => {
      const username = nonInvitedUserList[account];
      addMember(account, channelName, username);
    });
  }, [addMember, channelName, selectedUsers, nonInvitedUserList]);

  const updateUsers = useCallback(
    (value: string) => {
      getNonInvitedUsers(value);
    },
    [getNonInvitedUsers]
  );

  return (
    <MultipleInputPopup
      title={`Invite user to #${channelName}`}
      placeholder={"ex: John Doe"}
      buttonText={"Invite"}
      functionLoader={addUser}
      toggle={
        <AddMemberButton>
          <i className="bi bi-plus-circle-fill" />
          Add new member
        </AddMemberButton>
      }
      updateUsers={updateUsers}
      isChild={true}
      autocomplete={true}
      nonInvitedUserList={nonInvitedUserList}
      selectedUsers={selectedUsers}
      setSelectedUsers={setSelectedUsers}
    />
  );
};

// const OptionsWrapper = styled.div`
//   position: relative;
// `;

const OptionsWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const OptionsButton = styled.button`
  background: none;
  border: none;
  color: #c8c7d1;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
`;

const RoleBadge = styled.span`
  margin-left: 0.5rem;
  font-size: 12px;
  color: #777583;
`;

const OptionsWindow = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  transform: translateY(calc(-100% - 10px));
  min-width: 200px;
  display: flex;
  flex-direction: column;
  padding: 6px 0;
  border-radius: 6px;
  background-color: #1d1d21;
  border: solid 1px #282933;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
  z-index: 2000;
`;

const Option = styled.button`
  border: none;
  background: none;
  color: #777583;
  font-family: Helvetica Neue;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  text-align: start;
  line-height: 150%;
  cursor: pointer;
  padding: 0.4rem 1rem;
  &:hover {
    color: #fff;
  }
`;

interface MemberDetailsProps {
  members: User[];
  channelOwner: string;
  currentUserId?: string;
  promoteModerator: (userId: string) => void;
  demoteModerator: (userId: string) => void;
  removeUserFromChannel: (userId: string) => void;
  addMember: (account: string, channel: string, username?: string) => void;
  channelName: string;
  getNonInvitedUsers: (value: string) => UserId[];
  nonInvitedUserList: Record<string, string>;
}

const MemberDetails: React.FC<MemberDetailsProps> = (props) => {
  const {
    members,
    channelOwner,
    currentUserId,
    promoteModerator,
    demoteModerator,
    removeUserFromChannel,
  } = props;

  const effectiveCurrentUserId = currentUserId ?? "";

  const [optionsOpen, setOptionsOpen] = useState<string | null>(null);

  const handlePromote = useCallback(
    (userId: string) => {
      promoteModerator(userId);
      setOptionsOpen(null);
    },
    [promoteModerator]
  );

  const handleDemote = useCallback(
    (userId: string) => {
      demoteModerator(userId);
      setOptionsOpen(null);
    },
    [demoteModerator]
  );

  const handleRemove = useCallback(
    (userId: string) => {
      removeUserFromChannel(userId);
      setOptionsOpen(null);
    },
    [removeUserFromChannel]
  );

  return (
    <>
      <AddUserDialog
        addMember={props.addMember}
        channelName={props.channelName}
        getNonInvitedUsers={props.getNonInvitedUsers}
        nonInvitedUserList={props.nonInvitedUserList}
      />
      {optionsOpen && <OverLay onClick={() => setOptionsOpen(null)} />}
      <UserList>
        {members.map((member) => {
          const displayName = member.name ?? member.id;
          const isOwner = member.id === channelOwner;
          const isSelf = member.id === effectiveCurrentUserId;
          const canManage = !isOwner && !isSelf;
          return (
            <UserListItem key={member.id} style={{ position: "relative" }}>
              <UserInfo>
                <Avatar size="xs" name={displayName} />
                <Text $isSelected={optionsOpen === member.id}>
                  {displayName}
                  {isOwner && <RoleBadge>Owner</RoleBadge>}
                  {!isOwner && member.moderator && (
                    <RoleBadge>Moderator</RoleBadge>
                  )}
                </Text>
              </UserInfo>
              {canManage && (
                <OptionsWrapper>
                  <OptionsButton onClick={() => setOptionsOpen(member.id)}>
                    <i className="bi bi-three-dots" />
                  </OptionsButton>
                  {optionsOpen === member.id && (
                    <OptionsWindow>
                      {member.moderator ? (
                        <Option onClick={() => handleDemote(member.id)}>
                          Demote from moderator
                        </Option>
                      ) : (
                        <Option onClick={() => handlePromote(member.id)}>
                          Promote to moderator
                        </Option>
                      )}
                      <Option onClick={() => handleRemove(member.id)}>
                        Remove from channel
                      </Option>
                    </OptionsWindow>
                  )}
                </OptionsWrapper>
              )}
            </UserListItem>
          );
        })}
      </UserList>
    </>
  );
};

export default MemberDetails;
