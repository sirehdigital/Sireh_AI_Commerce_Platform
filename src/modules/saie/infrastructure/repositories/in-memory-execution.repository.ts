import {
  sameTenantStore,
  type ExecutionRecord,
  type ExecutionRepository,
  type TenantContext,
} from "../../application/index.js";

export class DuplicateExecutionRecordError extends Error {
  public constructor(executionId: string) {
    super(`Execution record ${executionId} already exists.`);
    this.name = "DuplicateExecutionRecordError";
  }
}

export class DuplicateExecutionPreparationError extends Error {
  public constructor(approvalId: string) {
    super(`Execution record for approval ${approvalId} already exists.`);
    this.name = "DuplicateExecutionPreparationError";
  }
}

export class InMemoryExecutionRepository implements ExecutionRepository {
  private readonly executionRecords: ExecutionRecord[];
  private readonly executionRecordsById: Map<string, ExecutionRecord>;
  private readonly executionRecordsByApprovalId: Map<string, ExecutionRecord>;

  public constructor(initialRecords: readonly ExecutionRecord[] = []) {
    this.executionRecords = [];
    this.executionRecordsById = new Map<string, ExecutionRecord>();
    this.executionRecordsByApprovalId = new Map<string, ExecutionRecord>();

    for (const record of initialRecords) {
      this.append(record, record);
    }
  }

  public list(context: TenantContext): readonly ExecutionRecord[] {
    return this.executionRecords
      .filter((record) => sameTenantStore(record, context))
      .map((record) => this.copyRecord(record));
  }

  public findById(context: TenantContext, executionId: string): ExecutionRecord | undefined {
    const record = this.executionRecordsById.get(executionId);

    return record === undefined || !sameTenantStore(record, context) ? undefined : this.copyRecord(record);
  }

  public findByApprovalId(context: TenantContext, approvalId: string): ExecutionRecord | undefined {
    const record = this.executionRecordsByApprovalId.get(approvalId);

    return record === undefined || !sameTenantStore(record, context) ? undefined : this.copyRecord(record);
  }

  public append(context: TenantContext, record: ExecutionRecord): ExecutionRecord {
    if (!sameTenantStore(record, context)) {
      throw new ExecutionTenantMismatchError(record.id);
    }

    if (this.executionRecordsById.has(record.id)) {
      throw new DuplicateExecutionRecordError(record.id);
    }

    if (
      record.approvalId !== undefined &&
      this.executionRecordsByApprovalId.has(record.approvalId)
    ) {
      throw new DuplicateExecutionPreparationError(record.approvalId);
    }

    const stored = this.copyRecord(record);
    this.executionRecords.push(stored);
    this.executionRecordsById.set(stored.id, stored);

    if (stored.approvalId !== undefined) {
      this.executionRecordsByApprovalId.set(stored.approvalId, stored);
    }

    return this.copyRecord(stored);
  }

  private copyRecord(record: ExecutionRecord): ExecutionRecord {
    return {
      ...record,
      executableActions: [],
    };
  }
}

export class ExecutionTenantMismatchError extends Error {
  public constructor(executionId: string) {
    super(`Execution record ${executionId} cannot be appended outside its tenant context.`);
    this.name = "ExecutionTenantMismatchError";
  }
}
