import type { TenantContext, WorkflowRecord, WorkflowRepository } from "../../application/index.js";
import { InMemoryWorkflowRepository, createDeterministicWorkflowSeedRecords } from "../../infrastructure/index.js";

export class WorkflowQueryService implements WorkflowRepository {
  private readonly workflowRepository: WorkflowRepository;

  public constructor(
    workflowRepository: WorkflowRepository = new InMemoryWorkflowRepository(
      createDeterministicWorkflowSeedRecords(),
    ),
  ) {
    this.workflowRepository = workflowRepository;
  }

  public list(context: TenantContext): readonly WorkflowRecord[] {
    return this.workflowRepository.list(context);
  }

  public findById(context: TenantContext, workflowId: string): WorkflowRecord | undefined {
    return this.workflowRepository.findById(context, workflowId);
  }

  public listWorkflows(context: TenantContext): readonly WorkflowRecord[] {
    return this.list(context);
  }

  public findWorkflow(context: TenantContext, workflowId: string): WorkflowRecord | null {
    return this.findById(context, workflowId) ?? null;
  }
}
