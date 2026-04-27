import { useEffect, useState } from "react";
import { GroupApiDataSource } from "../api/dataSource/groupApiDataSource";
import {
  getGroupMemberIdentity,
  setGroupMemberIdentity,
} from "../constants/config";
import {
  canCreateGroupContexts,
  canInviteWorkspaceMembers,
  canJoinOpenGroupContexts,
} from "../utils/groupCapabilities";

interface CurrentGroupPermissionsState {
  loading: boolean;
  memberIdentity: string;
  isAdmin: boolean;
  isModerator: boolean;
  capabilities: number | null;
  canCreateContext: boolean;
  canInviteMembers: boolean;
  canJoinOpenContexts: boolean;
}

const initialState: CurrentGroupPermissionsState = {
  loading: false,
  memberIdentity: "",
  isAdmin: false,
  isModerator: false,
  capabilities: null,
  canCreateContext: false,
  canInviteMembers: false,
  canJoinOpenContexts: false,
};

export function useCurrentGroupPermissions(groupId: string) {
  const [state, setState] = useState<CurrentGroupPermissionsState>(initialState);

  useEffect(() => {
    if (!groupId) {
      setState(initialState);
      return;
    }

    let cancelled = false;

    const loadPermissions = async () => {
      setState((previous) => ({ ...previous, loading: true }));

      const api = new GroupApiDataSource();
      const storedMemberIdentity = getGroupMemberIdentity(groupId);
      const identityResponse = await api.resolveCurrentMemberIdentity(
        groupId,
        storedMemberIdentity,
      );

      if (cancelled) {
        return;
      }

      if (identityResponse.error || !identityResponse.data) {
        setState(initialState);
        return;
      }

      const { memberIdentity, members } = identityResponse.data;
      setGroupMemberIdentity(groupId, memberIdentity);

      const currentMember = members.find(
        (member) => member.identity === memberIdentity,
      );

      if (!currentMember) {
        setState(initialState);
        return;
      }

      const role = String(currentMember.role ?? "").toLowerCase();

      if (role === "admin") {
        setState({
          loading: false,
          memberIdentity,
          isAdmin: true,
          isModerator: false,
          capabilities: null,
          canCreateContext: true,
          canInviteMembers: true,
          canJoinOpenContexts: true,
        });
        return;
      }

      if (role === "moderator") {
        setState({
          loading: false,
          memberIdentity,
          isAdmin: false,
          isModerator: true,
          capabilities: null,
          canCreateContext: true,
          canInviteMembers: true,
          canJoinOpenContexts: true,
        });
        return;
      }

      const capabilitiesResponse = await api.getMemberCapabilities(
        groupId,
        memberIdentity,
      );

      if (cancelled) {
        return;
      }

      const capabilities = capabilitiesResponse.data?.capabilities ?? null;

      setState({
        loading: false,
        memberIdentity,
        isAdmin: false,
        isModerator: false,
        capabilities,
        canCreateContext: canCreateGroupContexts(capabilities),
        canInviteMembers: canInviteWorkspaceMembers(capabilities),
        canJoinOpenContexts: canJoinOpenGroupContexts(capabilities),
      });
    };

    void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return state;
}
