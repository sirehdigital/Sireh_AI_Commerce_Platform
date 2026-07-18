import { sameTenantStore, type TenantContext, type WorkflowRecord, type WorkflowRepository } from "../../application/index.js";

export class DuplicateWorkflowRecordError extends Error {
  public constructor(workflowId: string) {
    super(`Workflow record ${workflowId} is already seeded.`);
    this.name = "DuplicateWorkflowRecordError";
  }
}

export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly workflowRecords: readonly WorkflowRecord[];
  private readonly workflowRecordsById: ReadonlyMap<string, WorkflowRecord>;

  public constructor(initialRecords: readonly WorkflowRecord[]) {
    const recordsById = new Map<string, WorkflowRecord>();
    const records = initialRecords.map((record) => this.copyRecord(record));

    for (const record of records) {
      if (recordsById.has(record.id)) {
        throw new DuplicateWorkflowRecordError(record.id);
      }

      recordsById.set(record.id, record);
    }

    this.workflowRecords = records;
    this.workflowRecordsById = recordsById;
  }

  public list(context: TenantContext): readonly WorkflowRecord[] {
    return this.workflowRecords
      .filter((record) => sameTenantStore(record, context))
      .map((record) => this.copyRecord(record));
  }

  public findById(context: TenantContext, workflowId: string): WorkflowRecord | undefined {
    const record = this.workflowRecordsById.get(workflowId);

    return record === undefined || !sameTenantStore(record, context) ? undefined : this.copyRecord(record);
  }

  private copyRecord(record: WorkflowRecord): WorkflowRecord {
    return {
      ...record,
      steps: record.steps.map((step) => ({
        ...step,
        dependsOn: [...step.dependsOn],
      })),
    };
  }
}
