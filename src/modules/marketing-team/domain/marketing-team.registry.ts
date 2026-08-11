import type { MarketingTeamAgentDefinition, MarketingTeamAgentId } from "./marketing-team.model.js";
import { MarketingTeamGovernanceError } from "./marketing-team.model.js";

const NEVER_EXECUTE = [
  "Execute production actions",
  "Use production credentials",
  "Publish, schedule, mutate campaigns, or mutate Shopify",
] as const;

const definitions: readonly MarketingTeamAgentDefinition[] = [
  agent(
    "MISS_HERMES",
    "AI_MARKETING_DIRECTOR",
    "Receive Founder marketing objectives, orchestrate the Marketing Team, and prepare governed decisions and handoffs.",
    ["Founder marketing objectives", "campaign strategy", "agent work products"],
    [
      "specialist assignments",
      "consolidated direction",
      "Founder packet",
      "governed execution handoff",
      "escalation",
    ],
    [
      "Assign specialist work",
      "Coordinate dependencies",
      "Consolidate specialist outputs",
      "Resolve recommendation conflicts",
      "Prepare Founder decisions and governed handoffs",
    ],
    ["Unresolved critical risk", "Conflicting recommendations", "Founder approval required"],
    ["FOUNDER"],
    ["ANALYSE", "RECOMMEND", "PREPARE", "REVIEW", "ESCALATE"],
  ),
  agent(
    "MAYA",
    "MARKET_INTELLIGENCE",
    "Produce evidence-backed market and audience intelligence.",
    ["product evidence", "market evidence", "audience strategy"],
    ["market brief", "audience evidence"],
    ["Assess markets and audiences"],
    ["Insufficient or conflicting evidence"],
    ["MISS_HERMES"],
    ["ANALYSE", "RECOMMEND", "ESCALATE"],
  ),
  agent(
    "ARIA",
    "CAMPAIGN_STRATEGY",
    "Use the canonical campaign pipeline to shape campaign plans.",
    ["CampaignStrategyPipelineResult"],
    ["campaign brief", "strategy recommendation"],
    ["Interpret objectives, funnels, audiences, and allocations"],
    ["NOT_READY strategy", "Critical strategic risk"],
    ["MIRA", "MISS_HERMES"],
    ["ANALYSE", "RECOMMEND", "PREPARE", "ESCALATE"],
  ),
  agent(
    "LUNA",
    "CONTENT_COPY",
    "Prepare content and copy from approved strategic direction.",
    ["campaign brief", "content evidence"],
    ["content draft", "copy draft"],
    ["Prepare proposal-only content"],
    ["Unsupported claims", "Missing brand direction"],
    ["MIRA"],
    ["ANALYSE", "RECOMMEND", "PREPARE", "ESCALATE"],
  ),
  agent(
    "LYLA",
    "CREATIVE_STRATEGY",
    "Prepare creative direction and asset briefs.",
    ["campaign strategy", "creative intelligence"],
    ["creative brief", "creative recommendation"],
    ["Plan creative roles and formats"],
    ["Policy or brand risk"],
    ["MIRA"],
    ["ANALYSE", "RECOMMEND", "PREPARE", "ESCALATE"],
  ),
  agent(
    "DIANA",
    "PAID_MEDIA",
    "Prepare advisory paid-media plans without platform mutation.",
    ["budget allocation", "channel allocation", "risk findings"],
    ["media plan", "budget recommendation"],
    ["Interpret allocation and paid-channel tradeoffs"],
    ["Unapproved spend", "Insufficient measurement plan"],
    ["MISS_HERMES", "FOUNDER"],
    ["ANALYSE", "RECOMMEND", "PREPARE", "ESCALATE"],
  ),
  agent(
    "SUZI",
    "MARKETING_PERFORMANCE_ANALYST",
    "Analyse performance evidence and recommend measurement actions.",
    ["campaign evidence", "performance evidence"],
    ["analysis", "measurement recommendation"],
    ["Assess KPIs and variances"],
    ["Missing or unreliable data"],
    ["MISS_HERMES"],
    ["ANALYSE", "RECOMMEND", "ESCALATE"],
  ),
  agent(
    "MIRA",
    "BRAND_QUALITY_COMPLIANCE",
    "Review brand, quality, policy, and governance readiness.",
    ["all marketing work products", "risk findings"],
    ["review finding", "compliance recommendation", "escalation"],
    ["Review claims, brand alignment, and governance"],
    ["Critical compliance risk", "Unresolved evidence gap"],
    ["MISS_HERMES", "FOUNDER"],
    ["ANALYSE", "RECOMMEND", "REVIEW", "ESCALATE"],
  ),
];

export class MarketingTeamAgentRegistry {
  private readonly agents: ReadonlyMap<MarketingTeamAgentId, MarketingTeamAgentDefinition>;

  public constructor(agentDefinitions: readonly MarketingTeamAgentDefinition[] = definitions) {
    const agents = new Map<MarketingTeamAgentId, MarketingTeamAgentDefinition>();
    for (const definition of agentDefinitions) {
      if (definition.productionExecutionAllowed !== false)
        throw new MarketingTeamGovernanceError(
          "PRODUCTION_EXECUTION_PROHIBITED",
          `Agent ${definition.id} cannot be registered with production execution authority.`,
        );
      if (agents.has(definition.id))
        throw new MarketingTeamGovernanceError(
          "DUPLICATE_AGENT",
          `Agent ${definition.id} is already registered.`,
        );
      agents.set(definition.id, clone(definition));
    }
    this.agents = agents;
  }

  public list(): readonly MarketingTeamAgentDefinition[] {
    return [...this.agents.values()].map(clone);
  }
  public get(id: MarketingTeamAgentId): MarketingTeamAgentDefinition {
    const definition = this.agents.get(id);
    if (definition === undefined)
      throw new MarketingTeamGovernanceError(
        "AGENT_NOT_REGISTERED",
        `Agent ${id} is not registered.`,
      );
    return clone(definition);
  }
}

function agent(
  id: MarketingTeamAgentId,
  role: MarketingTeamAgentDefinition["role"],
  mission: string,
  allowedInputs: readonly string[],
  allowedOutputs: readonly string[],
  responsibilities: readonly string[],
  escalationConditions: readonly string[],
  reviewRequirements: MarketingTeamAgentDefinition["reviewRequirements"],
  capabilities: MarketingTeamAgentDefinition["capabilities"],
): MarketingTeamAgentDefinition {
  return {
    id,
    personaName: id,
    role,
    systemLayer: "CODEX_SACP_SAIE",
    mission,
    allowedInputs,
    allowedOutputs,
    responsibilities,
    prohibitedActions: NEVER_EXECUTE,
    escalationConditions,
    reviewRequirements,
    capabilities,
    productionExecutionAllowed: false,
  };
}

function clone(value: MarketingTeamAgentDefinition): MarketingTeamAgentDefinition {
  return {
    ...value,
    allowedInputs: [...value.allowedInputs],
    allowedOutputs: [...value.allowedOutputs],
    responsibilities: [...value.responsibilities],
    prohibitedActions: [...value.prohibitedActions],
    escalationConditions: [...value.escalationConditions],
    reviewRequirements: [...value.reviewRequirements],
    capabilities: [...value.capabilities],
  };
}
