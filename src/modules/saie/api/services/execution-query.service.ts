import type { ExecutionRecord, ExecutionRepository, TenantContext } from "../../application/index.js";
import {
  InMemoryExecutionRepository,
  createDeterministicExecutionSeedRecords,
} from "../../infrastructure/index.js";

export class ExecutionQueryService implements ExecutionRepository {
  private readonly executionRepository: ExecutionRepository;

  public constructor(
    executionRepository: ExecutionRepository = new InMemoryExecutionRepository(
      createDeterministicExecutionSeedRecords(),
    ),
  ) {
    this.executionRepository = executionRepository;
  }

  public list(context: TenantContext): readonly ExecutionRecord[] {
    return this.executionRepository.list(context);
  }

  public findById(context: TenantContext, executionId: string): ExecutionRecord | undefined {
    return this.executionRepository.findById(context, executionId);
  }

  public findByApprovalId(context: TenantContext, approvalId: string): ExecutionRecord | undefined {
    return this.executionRepository.findByApprovalId(context, approvalId);
  }

  public append(context: TenantContext, record: ExecutionRecord): ExecutionRecord {
    return this.executionRepository.append(context, record);
  }

  public listExecutions(context: TenantContext): readonly ExecutionRecord[] {
    return this.list(context);
  }

  public findExecution(context: TenantContext, executionId: string): ExecutionRecord | null {
    return this.findById(context, executionId) ?? null;
  }
}
