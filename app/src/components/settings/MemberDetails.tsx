import React, { useCallback, useState } from "react";
import styled from "styled-components";
import type { User } from "../../types/Common";
import MultipleInputPopup from "../common/popups/MultipleInputPopup";
import { Avatar } from "@calimero-network/mero-ui";
import type { UserId } from "../../api/clientApi";

const AddMemberButton = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(165, 255, 17, 0.06);
    border-color: rgba(165, 255, 17, 0.2);
    color: #a5ff11;
  }
`;

const UserListItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.625rem;
  border-radius: 8px;
  cursor: default;
  transition: background 0.12s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const UserList = styled.div`
  overflow-y: auto;
  max-height: 22rem;
  @media (max-width: 1024px) {
    max-height: 12rem;
  }
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
`;

const Text = styled.div<{ $isSelected?: boolean }>`
  font-size: 0.82rem;
  font-weight: 500;
  color: ${({ $isSelected }) => ($isSelected ? "#a5ff11" : "rgba(255,255,255,0.85)")};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  position: absolute;
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
  addMember: (account: string, channel: string) => void;
  channelName: string;
  getNonInvitedUsers: (value: string) => UserId[];
  nonInvitedUserList: UserId[];
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
      const identityId = Object.keys(nonInvitedUserList).find(
        // @ts-expect-error - nonInvitedUserList is a Map
        (u) => nonInvitedUserList[u] === account,
      ) as string;
      addMember(identityId, channelName);
    });
  }, [addMember, channelName, selectedUsers]);

  const updateUsers = useCallback((value: string) => {
    getNonInvitedUsers(value);
  }, []);

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

interface MemberDetailsProps {
  id: number;
  user: UserId;
  promoteModerator: (userId: string, isModerator: boolean) => void;
  removeUserFromChannel: (userId: string) => void;
  channelOwner: string;
  optionsOpen: number;
  setOptionsOpen: (id: number) => void;
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
  userList: Map<string, string>;
  addMember: (account: string, channel: string) => void;
  channelName: string;
  getNonInvitedUsers: (value: string) => UserId[];
  nonInvitedUserList: UserId[];
}

const MemberDetails: React.FC<MemberDetailsProps> = (props) => {
  const userList = props.userList;
  // const promoteModerator = props.promoteModerator;
  // const removeUserFromChannel = props.removeUserFromChannel;
  // const channelOwner = props.channelOwner;

  const [optionsOpen, setOptionsOpen] = useState(-1);

  //const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // const ModeratorOptionsPopup = ({ id, user, length }: { id: number; user: User, length: number }) => {
  //   return (
  //     <OptionsWrapper>
  //       <OptionsButton
  //         handleClick={() => {
  //           setOptionsOpen(id);
  //           setSelectedUser(user);
  //         }}
  //       />
  //       {optionsOpen === id && (
  //         <TopOverlay bottomPadding={length - 3 <= id}>
  //           <OptionsWindow>
  //             {selectedUser && selectedUser.id !== channelOwner && (
  //               <Option
  //                 onClick={() =>
  //                   promoteModerator(selectedUser.id, !selectedUser.moderator)
  //                 }
  //               >{`${
  //                 selectedUser.moderator ? "Remove moderator" : "Make moderator"
  //               }`}</Option>
  //             )}
  //             {selectedUser && (
  //               <Option onClick={() => removeUserFromChannel(selectedUser.id)}>
  //                 Remove from channel
  //               </Option>
  //             )}
  //           </OptionsWindow>
  //         </TopOverlay>
  //       )}
  //     </OptionsWrapper>
  //   );
  // };

  return (
    <>
      <AddUserDialog
        addMember={props.addMember}
        channelName={props.channelName}
        getNonInvitedUsers={props.getNonInvitedUsers}
        nonInvitedUserList={props.nonInvitedUserList}
      />
      {optionsOpen !== -1 && <OverLay onClick={() => setOptionsOpen(-1)} />}
      <UserList>
        {userList.size > 0 &&
          Array.from(userList.entries()).map(([identity, username], id) => (
            <UserListItem key={identity}>
              <UserInfo>
                <Avatar size="xs" name={username ?? ""} />
                <Text $isSelected={optionsOpen === id}>
                  {username}
                </Text>
              </UserInfo>
              {/* TODO: Add moderator options */}
              {/* <ModeratorOptions>
                {(user.moderator || channelOwner === user.id) && (
                  <RoleText>{`${
                    channelOwner === user.id
                      ? "Channel Owner"
                      : "Channel Moderator"
                  }`}</RoleText>
                )}
                {channelOwner !== user.id && (
                  <ModeratorOptionsPopup id={id} user={user} length={userList.length}/>
                )}
              </ModeratorOptions> */}
            </UserListItem>
          ))}
      </UserList>
    </>
  );
};

export default MemberDetails;
