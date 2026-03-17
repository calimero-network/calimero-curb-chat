import React, { useState, useEffect } from "react";
import styled from "styled-components";
import type { GroupInfo, VisibilityMode } from "../../api/groupApi";
import {
  buildGroupCapabilitiesMask,
  readGroupCapabilitiesMask,
  type GroupCapabilityToggles,
} from "../../utils/groupCapabilities";

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const SectionTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.5rem;
`;

const Description = styled.div`
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 0.5rem;
  line-height: 1.4;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const Label = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  min-width: 120px;
`;

const Value = styled.span`
  font-size: 0.78rem;
  color: #fff;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  background: ${({ $active }) =>
    $active ? "rgba(165, 255, 17, 0.12)" : "rgba(255, 255, 255, 0.06)"};
  border: 1px solid
    ${({ $active }) =>
      $active ? "rgba(165, 255, 17, 0.3)" : "rgba(255, 255, 255, 0.08)"};
  color: ${({ $active }) => ($active ? "#a5ff11" : "rgba(255, 255, 255, 0.5)")};
  font-size: 0.72rem;
  font-weight: 500;
  padding: 0.25rem 0.625rem;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const CapabilitiesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const CapabilityRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.625rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
`;

const CapabilityInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

const CapabilityTitle = styled.div`
  color: #fff;
  font-size: 0.78rem;
  font-weight: 500;
`;

const CapabilityDescription = styled.div`
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.68rem;
  line-height: 1.4;
`;

const CapabilityToggle = styled.input`
  width: 18px;
  height: 18px;
  accent-color: #a5ff11;
  cursor: pointer;
`;

const SaveButton = styled.button`
  background: rgba(165, 255, 17, 0.1);
  border: 1px solid rgba(165, 255, 17, 0.25);
  color: #a5ff11;
  font-size: 0.72rem;
  font-weight: 500;
  padding: 0.3rem 0.75rem;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    background: rgba(165, 255, 17, 0.18);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.625rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 1.5rem;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.82rem;
`;

interface SettingsTabProps {
  groupId: string;
  group: GroupInfo | null;
  actionLoading: boolean;
  onSetDefaultCapabilities: (
    groupId: string,
    capabilities: number,
  ) => Promise<boolean>;
  onSetDefaultVisibility: (
    groupId: string,
    mode: VisibilityMode,
  ) => Promise<boolean>;
}

export default function SettingsTab({
  groupId,
  group,
  actionLoading,
  onSetDefaultCapabilities,
  onSetDefaultVisibility,
}: SettingsTabProps) {
  const [capToggles, setCapToggles] = useState<GroupCapabilityToggles>({
    canCreateContext: false,
    canInviteMembers: false,
    canJoinOpenContexts: false,
  });

  useEffect(() => {
    if (group) {
      setCapToggles(readGroupCapabilitiesMask(group.defaultCapabilities));
    }
  }, [group]);

  if (!group) {
    return <EmptyState>No group data available</EmptyState>;
  }

  const handleSaveCapabilities = async () => {
    await onSetDefaultCapabilities(
      groupId,
      buildGroupCapabilitiesMask(capToggles),
    );
  };

  const handleToggleVisibility = async (mode: VisibilityMode) => {
    await onSetDefaultVisibility(groupId, mode);
  };

  return (
    <>
      <Section>
        <SectionTitle>Group Info</SectionTitle>
        <InfoGrid>
          <Label>Group ID</Label>
          <Value style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>
            {group.groupId}
          </Value>
          <Label>Application</Label>
          <Value style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>
            {group.targetApplicationId}
          </Value>
          <Label>Members</Label>
          <Value>{group.memberCount}</Value>
          <Label>Contexts</Label>
          <Value>{group.contextCount}</Value>
          <Label>Upgrade Policy</Label>
          <Value>
            {typeof group.upgradePolicy === "string"
              ? group.upgradePolicy
              : "Coordinated"}
          </Value>
        </InfoGrid>
      </Section>

      <Section>
        <SectionTitle>Default Visibility</SectionTitle>
        <Description>
          New contexts created in this group will inherit this visibility mode.
        </Description>
        <Row>
          <ToggleButton
            $active={group.defaultVisibility === "open"}
            onClick={() => handleToggleVisibility("open")}
            disabled={actionLoading || group.defaultVisibility === "open"}
          >
            Open
          </ToggleButton>
          <ToggleButton
            $active={group.defaultVisibility === "restricted"}
            onClick={() => handleToggleVisibility("restricted")}
            disabled={actionLoading || group.defaultVisibility === "restricted"}
          >
            Restricted
          </ToggleButton>
        </Row>
      </Section>

      <Section>
        <SectionTitle>Default Capabilities</SectionTitle>
        <Description>
          Permissions applied to new members when they join the group.
        </Description>
        <CapabilitiesList>
          <CapabilityRow>
            <CapabilityInfo>
              <CapabilityTitle>Create channels</CapabilityTitle>
              <CapabilityDescription>
                Let new members create new channels in the workspace.
              </CapabilityDescription>
            </CapabilityInfo>
            <CapabilityToggle
              type="checkbox"
              aria-label="Create channels"
              checked={capToggles.canCreateContext}
              onChange={(e) =>
                setCapToggles((current) => ({
                  ...current,
                  canCreateContext: e.target.checked,
                }))
              }
            />
          </CapabilityRow>
          <CapabilityRow>
            <CapabilityInfo>
              <CapabilityTitle>Invite members</CapabilityTitle>
              <CapabilityDescription>
                Let new members invite other people into the workspace.
              </CapabilityDescription>
            </CapabilityInfo>
            <CapabilityToggle
              type="checkbox"
              aria-label="Invite members"
              checked={capToggles.canInviteMembers}
              onChange={(e) =>
                setCapToggles((current) => ({
                  ...current,
                  canInviteMembers: e.target.checked,
                }))
              }
            />
          </CapabilityRow>
          <CapabilityRow>
            <CapabilityInfo>
              <CapabilityTitle>Join open channels</CapabilityTitle>
              <CapabilityDescription>
                Let new members join channels marked as open.
              </CapabilityDescription>
            </CapabilityInfo>
            <CapabilityToggle
              type="checkbox"
              aria-label="Join open channels"
              checked={capToggles.canJoinOpenContexts}
              onChange={(e) =>
                setCapToggles((current) => ({
                  ...current,
                  canJoinOpenContexts: e.target.checked,
                }))
              }
            />
          </CapabilityRow>
        </CapabilitiesList>
        <SaveButton
          onClick={handleSaveCapabilities}
          disabled={
            actionLoading ||
            buildGroupCapabilitiesMask(capToggles) === group.defaultCapabilities
          }
        >
          Save
        </SaveButton>
      </Section>
    </>
  );
}
