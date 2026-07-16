export const MARKETING_AGENT_PORT_IDENTIFIERS = [
  "PreparedProductContextPort",
  "BrandContextPort",
  "MarketingProposalPort",
  "HumanApprovalPort",
] as const;

export type MarketingAgentPortIdentifier = (typeof MARKETING_AGENT_PORT_IDENTIFIERS)[number];

export interface MarketingAgentPortRequirement {
  readonly identifier: MarketingAgentPortIdentifier;
  readonly purpose: string;
}

export interface MarketingAgentPorts {
  readonly preparedProductContext?: unknown;
  readonly brandContext?: unknown;
  readonly marketingProposal?: unknown;
  readonly humanApproval?: unknown;
}
