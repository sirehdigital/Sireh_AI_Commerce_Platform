import type { ContentAgentStep } from "./content-agent.types.js";

const CONTENT_AGENT_STEP_TEMPLATES: readonly Omit<ContentAgentStep, "order" | "mutatesData">[] = [
  {
    id: "ValidateContentContext",
    name: "Validate prepared product, brand, audience, and marketing context",
    requiredPort: "PreparedContentContextPort",
  },
  {
    id: "AdaptAIContentCapability",
    name: "Use existing AI Content capability through a controlled adapter",
    requiredPort: "AIContentCapabilityPort",
  },
  {
    id: "BuildContentProposal",
    name: "Build deterministic content proposal",
    requiredPort: "ContentProposalPort",
  },
  {
    id: "RequireHumanApproval",
    name: "Require human approval",
    requiredPort: "HumanApprovalPort",
  },
];

export const createContentAgentSteps = (): readonly ContentAgentStep[] =>
  CONTENT_AGENT_STEP_TEMPLATES.map((template, index) => ({
    ...template,
    order: index + 1,
    mutatesData: false,
  }));
