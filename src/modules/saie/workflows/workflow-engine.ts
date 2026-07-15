import type { SAIEAgentRegistry } from "../agents/index.js";
import type { SAIEWorkflowDefinition, SAIEWorkflowPlan } from "../types/index.js";

const DEFAULT_WORKFLOW_DEFINITIONS: readonly SAIEWorkflowDefinition[] = [
  {
    id: "shopify-product-orchestration",
    name: "Shopify Product Orchestration",
    description:
      "Future wrapper flow from Shopify product context through existing analyzer, branding, copy, pricing, and update services.",
    status: "draft",
    steps: [
      {
        id: "product-analysis",
        name: "Analyze product context",
        agentType: "ProductAgent",
        dependsOn: [],
      },
      {
        id: "brand-positioning",
        name: "Plan brand positioning",
        agentType: "BrandingAgent",
        dependsOn: ["product-analysis"],
      },
      {
        id: "copy-planning",
        name: "Plan product copy",
        agentType: "CopyAgent",
        dependsOn: ["brand-positioning"],
      },
      {
        id: "pricing-planning",
        name: "Plan pricing posture",
        agentType: "PricingAgent",
        dependsOn: ["product-analysis"],
      },
    ],
  },
];

export class SAIEWorkflowEngine {
  private readonly workflowsById: ReadonlyMap<string, SAIEWorkflowDefinition>;

  public constructor(
    private readonly agentRegistry: SAIEAgentRegistry,
    workflowDefinitions: readonly SAIEWorkflowDefinition[] = DEFAULT_WORKFLOW_DEFINITIONS,
  ) {
    this.workflowsById = new Map(workflowDefinitions.map((workflow) => [workflow.id, workflow]));
  }

  public listDefinitions(): readonly SAIEWorkflowDefinition[] {
    return Array.from(this.workflowsById.values()).map((workflow) => ({
      ...workflow,
      steps: workflow.steps.map((step) => ({ ...step, dependsOn: [...step.dependsOn] })),
    }));
  }

  public definePlan(workflowId: string): SAIEWorkflowPlan | null {
    const workflow = this.workflowsById.get(workflowId);

    if (workflow === undefined || !this.hasRegisteredAgents(workflow)) {
      return null;
    }

    return {
      workflowId: workflow.id,
      status: "defined-only",
      steps: workflow.steps.map((step) => ({ ...step, dependsOn: [...step.dependsOn] })),
    };
  }

  private hasRegisteredAgents(workflow: SAIEWorkflowDefinition): boolean {
    return workflow.steps.every((step) => this.agentRegistry.has(step.agentType));
  }
}
