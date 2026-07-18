import {
  DEFAULT_TENANT_CONTEXT,
  type ExecutionRecord,
  type TenantContext,
  type WorkflowRepository,
} from "../../application/index.js";
import { InMemoryWorkflowRepository } from "./in-memory-workflow.repository.js";
import { createDeterministicWorkflowSeedRecords } from "./workflow-seed.provider.js";

export const createDeterministicExecutionSeedRecords = (
  workflowRepository: WorkflowRepository = new InMemoryWorkflowRepository(
    createDeterministicWorkflowSeedRecords(),
  ),
  context: TenantContext = DEFAULT_TENANT_CONTEXT,
): readonly ExecutionRecord[] =>
  workflowRepository.list(context).map((workflow, index) => ({
    tenantId: context.tenantId,
    storeId: context.storeId,
    ...(context.shopDomain === undefined ? {} : { shopDomain: context.shopDomain }),
    id: `execution-preview-${workflow.id}`,
    workflowId: workflow.id,
    title: `${workflow.name} execution preview`,
    status: "DISABLED",
    mode: "preview",
    executionEnabled: false,
    approvalRequired: true,
    executableActions: [],
    source: "deterministic-preview",
    sequence: index + 1,
  }));
