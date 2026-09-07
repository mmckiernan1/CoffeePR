export type PilotWorkspaceScope = {
  workspaceId: string;
  profileId: string;
  stateId: string;
  paymentStateId: string;
  membershipId: string;
};

export function pilotWorkspaceScope(userId: string): PilotWorkspaceScope {
  const trimmed = userId.trim();
  if (!trimmed) throw new Error("Authenticated user id is required.");
  if (trimmed.length > 160) throw new Error("Authenticated user id is too long.");

  return {
    workspaceId: `WS-PILOT-${trimmed}`,
    profileId: `PWP-${trimmed}`,
    stateId: `UAT-${trimmed}`,
    paymentStateId: `PAY-UAT-${trimmed}`,
    membershipId: `MEM-PILOT-${trimmed}`,
  };
}
