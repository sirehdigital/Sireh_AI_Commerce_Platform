import { SAIEAgentRegistry } from "../agents/index.js";
import type { SAIEAgentDefinition, SAIEAgentType } from "../types/index.js";

export class SAIERegistryService {
  public constructor(private readonly registry: SAIEAgentRegistry = new SAIEAgentRegistry()) {}

  public listAgents(): readonly SAIEAgentDefinition[] {
    return this.registry.list();
  }

  public findAgent(agentType: SAIEAgentType): SAIEAgentDefinition | null {
    return this.registry.get(agentType);
  }
}
