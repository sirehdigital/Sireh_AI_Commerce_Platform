import { ProductAdapterReadinessService } from "../adapters/index.js";
import { SAIEAgentRegistry, createDefaultSAIEAgentRegistry } from "../agents/index.js";
import { ProductAgent, ProductAgentInputValidationError } from "../agents/product/index.js";
import type {
  ProductAgentOutput,
  ProductAdapterReadinessReport,
  SAIEAgentDefinition,
  SAIEContext,
  SAIERequest,
  SAIEResponse,
} from "../types/index.js";
import { SAIEWorkflowEngine } from "../workflows/index.js";

interface ArchitectureOnlyPlanResult extends Readonly<Record<string, unknown>> {
  readonly workflowStatus: "not-executed";
}

type SAIEPlanResult = ArchitectureOnlyPlanResult | ProductAgentOutput;

export interface SAIEEngineDependencies {
  readonly agentRegistry: SAIEAgentRegistry;
  readonly workflowEngine: SAIEWorkflowEngine;
  readonly productAgent: ProductAgent;
  readonly productAdapterReadinessService: ProductAdapterReadinessService;
}

export class SAIEEngine {
  private readonly agentRegistry: SAIEAgentRegistry;
  private readonly workflowEngine: SAIEWorkflowEngine;
  private readonly productAgent: ProductAgent;
  private readonly productAdapterReadinessService: ProductAdapterReadinessService;

  public constructor(dependencies: SAIEEngineDependencies = createDefaultDependencies()) {
    this.agentRegistry = dependencies.agentRegistry;
    this.workflowEngine = dependencies.workflowEngine;
    this.productAgent = dependencies.productAgent;
    this.productAdapterReadinessService = dependencies.productAdapterReadinessService;
  }

  public listAgents(): readonly SAIEAgentDefinition[] {
    return this.agentRegistry.list();
  }

  public createContext(input: SAIEContext): SAIEContext {
    return {
      ...input,
      metadata: { ...input.metadata },
    };
  }

  public plan(request: SAIERequest): SAIEResponse<SAIEPlanResult> {
    const registeredAgent = this.agentRegistry.get(request.targetAgent);

    if (registeredAgent === null) {
      return {
        requestId: request.id,
        context: request.context,
        status: "rejected",
        result: { workflowStatus: "not-executed" },
        warnings: [`Agent ${request.targetAgent} is not registered.`],
      };
    }

    if (request.targetAgent === "ProductAgent") {
      return this.planProductAgent(request);
    }

    return {
      requestId: request.id,
      context: request.context,
      status: "rejected",
      result: { workflowStatus: "not-executed" },
      warnings: [`Agent ${request.targetAgent} does not have a planning implementation.`],
    };
  }

  public listWorkflowDefinitions(): ReturnType<SAIEWorkflowEngine["listDefinitions"]> {
    return this.workflowEngine.listDefinitions();
  }

  public getProductAdapterReadinessReport(
    generatedAt: Date = new Date(),
  ): ProductAdapterReadinessReport {
    return this.productAdapterReadinessService.createReport(generatedAt);
  }

  private planProductAgent(request: SAIERequest): SAIEResponse<SAIEPlanResult> {
    try {
      return {
        requestId: request.id,
        context: request.context,
        status: "planned",
        result: this.productAgent.planFromPayload(request.payload),
        warnings: ["SAIE Product Agent generated a plan only. No execution or mutation was performed."],
      };
    } catch (error) {
      if (error instanceof ProductAgentInputValidationError) {
        return {
          requestId: request.id,
          context: request.context,
          status: "rejected",
          result: { workflowStatus: "not-executed" },
          warnings: [error.message],
        };
      }

      throw error;
    }
  }
}

const createDefaultDependencies = (): SAIEEngineDependencies => {
  const agentRegistry = createDefaultSAIEAgentRegistry();

  return {
    agentRegistry,
    workflowEngine: new SAIEWorkflowEngine(agentRegistry),
    productAgent: new ProductAgent(),
    productAdapterReadinessService: new ProductAdapterReadinessService(),
  };
};
