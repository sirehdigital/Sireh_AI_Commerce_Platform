import type { MarketingAgentStep } from "./marketing-agent.types.js";

const MARKETING_AGENT_STEP_TEMPLATES: readonly Omit<MarketingAgentStep, "order" | "mutatesData">[] = [
  {
    id: "ValidatePreparedContext",
    name: "Validate prepared product and brand context",
    requiredPort: "PreparedProductContextPort",
  },
  {
    id: "DefineCampaignObjective",
    name: "Define proposal-only campaign objective",
    requiredPort: "MarketingProposalPort",
  },
  {
    id: "IdentifyTargetAudience",
    name: "Identify target audience and pain points",
    requiredPort: "BrandContextPort",
  },
  {
    id: "BuildMarketingProposal",
    name: "Build deterministic marketing proposal",
    requiredPort: "MarketingProposalPort",
  },
  {
    id: "RequireHumanApproval",
    name: "Require human approval",
    requiredPort: "HumanApprovalPort",
  },
];

export const createMarketingAgentSteps = (): readonly MarketingAgentStep[] =>
  MARKETING_AGENT_STEP_TEMPLATES.map((template, index) => ({
    ...template,
    order: index + 1,
    mutatesData: false,
  }));
