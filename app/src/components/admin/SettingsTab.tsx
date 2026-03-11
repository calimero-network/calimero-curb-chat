import React, { useState, useEffect } from "react";
import styled from "styled-components";
import type { GroupInfo, VisibilityMode } from "../../api/groupApi";

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

const CapInput = styled.input`
  width: 120px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  color: #fff;
  font-size: 0.78rem;
  padding: 0.375rem 0.5rem;
  outline: none;
  &:focus {
    border-color: rgba(165, 255, 17, 0.4);
  }
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
  const [capValue, setCapValue] = useState("");

  useEffect(() => {
    if (group) {
      setCapValue(group.defaultCapabilities.toString());
    }
  }, [group]);

  if (!group) {
    return <EmptyState>No group data available</EmptyState>;
  }

  const handleSaveCapabilities = async () => {
    const num = parseInt(capValue, 10);
    if (isNaN(num)) return;
    await onSetDefaultCapabilities(groupId, num);
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
          Bitmask applied to new members when they join the group.
        </Description>
        <Row>
          <CapInput
            type="number"
            value={capValue}
            onChange={(e) => setCapValue(e.target.value)}
            placeholder="Bitmask"
          />
          <SaveButton
            onClick={handleSaveCapabilities}
            disabled={
              actionLoading ||
              capValue === group.defaultCapabilities.toString()
            }
          >
            Save
          </SaveButton>
        </Row>
      </Section>
    </>
  );
}
