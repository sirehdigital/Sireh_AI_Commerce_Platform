import { CONTENT_AGENT_DEFINITION } from "./content/index.js";
import { MARKETING_AGENT_DEFINITION } from "./marketing/index.js";
import { PRODUCT_AGENT_DEFINITION } from "./product/index.js";
import type { SAIEAgentDefinition, SAIEAgentType } from "../types/index.js";

const DEFAULT_AGENT_DEFINITIONS: readonly SAIEAgentDefinition[] = [
  PRODUCT_AGENT_DEFINITION,
  {
    ...CONTENT_AGENT_DEFINITION,
  },
  {
    type: "BrandingAgent",
    name: "Branding Agent",
    description: "Coordinates future brand-positioning workflows around the existing branding engine.",
    capabilities: ["brand-positioning"],
    implementationStatus: "registry-only",
  },
  {
    type: "CopyAgent",
    name: "Copy Agent",
    description: "Coordinates future product-copy workflows around the existing copy engine.",
    capabilities: ["copy-planning"],
    implementationStatus: "registry-only",
  },
  {
    type: "SEOAgent",
    name: "SEO Agent",
    description: "Coordinates future SEO planning workflows without replacing existing SEO modules.",
    capabilities: ["seo-planning"],
    implementationStatus: "registry-only",
  },
  {
    type: "PricingAgent",
    name: "Pricing Agent",
    description: "Coordinates future price-planning workflows around the existing pricing engine.",
    capabilities: ["pricing-planning"],
    implementationStatus: "registry-only",
  },
  {
    ...MARKETING_AGENT_DEFINITION,
  },
  {
    type: "AnalyticsAgent",
    name: "Analytics Agent",
    description: "Coordinates future analytics workflows for commerce and content intelligence.",
    capabilities: ["analytics-planning"],
    implementationStatus: "registry-only",
  },
  {
    type: "CEOAgent",
    name: "CEO Agent",
    description: "Coordinates future executive orchestration across registered SAIE agents.",
    capabilities: ["executive-orchestration"],
    implementationStatus: "registry-only",
  },
];

export class SAIEAgentRegistry {
  private readonly agentsByType: ReadonlyMap<SAIEAgentType, SAIEAgentDefinition>;

  public constructor(agentDefinitions: readonly SAIEAgentDefinition[] = DEFAULT_AGENT_DEFINITIONS) {
    this.agentsByType = this.buildRegistry(agentDefinitions);
  }

  public list(): readonly SAIEAgentDefinition[] {
    return Array.from(this.agentsByType.values()).map((agent) => ({ ...agent }));
  }

  public get(agentType: SAIEAgentType): SAIEAgentDefinition | null {
    const agent = this.agentsByType.get(agentType);

    if (agent === undefined) {
      return null;
    }

    return { ...agent };
  }

  public has(agentType: SAIEAgentType): boolean {
    return this.agentsByType.has(agentType);
  }

  private buildRegistry(
    agentDefinitions: readonly SAIEAgentDefinition[],
  ): ReadonlyMap<SAIEAgentType, SAIEAgentDefinition> {
    const agents = new Map<SAIEAgentType, SAIEAgentDefinition>();

    for (const agent of agentDefinitions) {
      if (agents.has(agent.type)) {
        throw new DuplicateSAIEAgentRegistrationError(agent.type);
      }

      agents.set(agent.type, {
        ...agent,
        capabilities: [...agent.capabilities],
      });
    }

    return agents;
  }
}

export const createDefaultSAIEAgentRegistry = (): SAIEAgentRegistry => new SAIEAgentRegistry();

export class DuplicateSAIEAgentRegistrationError extends Error {
  public constructor(agentType: SAIEAgentType) {
    super(`SAIE agent ${agentType} is already registered.`);
    this.name = "DuplicateSAIEAgentRegistrationError";
  }
}
