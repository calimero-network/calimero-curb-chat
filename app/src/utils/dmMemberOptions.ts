import type { GroupMember } from "../api/groupApi";

export function buildDmMemberOptions(params: {
  groupMembers: GroupMember[];
  currentMemberIdentity: string;
  labelsByIdentity: Map<string, string>;
}): Map<string, string> {
  const options = new Map<string, string>();

  params.groupMembers.forEach((member) => {
    if (
      !member.identity ||
      member.identity === params.currentMemberIdentity
    ) {
      return;
    }

    options.set(
      member.identity,
      member.alias?.trim() ||
        params.labelsByIdentity.get(member.identity) ||
        member.identity,
    );
  });

  return options;
}
