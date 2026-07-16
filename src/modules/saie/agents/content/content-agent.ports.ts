import type { ContentAgentInput, ContentCapabilityDraft } from "./content-agent.types.js";

export const CONTENT_AGENT_PORT_IDENTIFIERS = [
  "PreparedContentContextPort",
  "AIContentCapabilityPort",
  "ContentProposalPort",
  "HumanApprovalPort",
] as const;

export type ContentAgentPortIdentifier = (typeof CONTENT_AGENT_PORT_IDENTIFIERS)[number];

export interface ContentAgentPortRequirement {
  readonly identifier: ContentAgentPortIdentifier;
  readonly purpose: string;
}

export interface ContentAgentAIContentPort {
  readonly createDraft: (input: ContentAgentInput) => ContentCapabilityDraft;
}

export interface ContentAgentPorts {
  readonly preparedContentContext?: unknown;
  readonly aiContentCapability?: ContentAgentAIContentPort;
  readonly contentProposal?: unknown;
  readonly humanApproval?: unknown;
}
