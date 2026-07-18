import { SAIEAgentRegistry } from "../../agents/index.js";
import { DEFAULT_TENANT_CONTEXT, type TenantContext, type WorkflowRecord } from "../../application/index.js";
import { SAIEWorkflowEngine } from "../../workflows/index.js";

export const createDeterministicWorkflowSeedRecords = (
  workflowEngine: SAIEWorkflowEngine = new SAIEWorkflowEngine(new SAIEAgentRegistry()),
  context: TenantContext = DEFAULT_TENANT_CONTEXT,
): readonly WorkflowRecord[] =>
  workflowEngine.listDefinitions().map((workflow) => ({
    tenantId: context.tenantId,
    storeId: context.storeId,
    ...(context.shopDomain === undefined ? {} : { shopDomain: context.shopDomain }),
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      name: step.name,
      agentType: step.agentType,
      dependsOn: [...step.dependsOn],
    })),
    source: "deterministic-preview",
    approvalRequired: true,
    executionEnabled: false,
  }));
