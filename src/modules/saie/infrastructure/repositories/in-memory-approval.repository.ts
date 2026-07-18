import { sameTenantStore, type ApprovalRecord, type ApprovalRepository, type TenantContext } from "../../application/index.js";
import { ApprovalVersionConflictError } from "../../application/index.js";

export class DuplicateApprovalRecordError extends Error {
  public constructor(approvalId: string) {
    super(`Approval record ${approvalId} is already seeded.`);
    this.name = "DuplicateApprovalRecordError";
  }
}

export class InMemoryApprovalRepository implements ApprovalRepository {
  private readonly approvalOrder: readonly string[];
  private readonly approvalRecordsById: Map<string, ApprovalRecord>;

  public constructor(initialRecords: readonly ApprovalRecord[]) {
    const recordsById = new Map<string, ApprovalRecord>();
    const order: string[] = [];

    for (const record of initialRecords) {
      if (recordsById.has(record.id)) {
        throw new DuplicateApprovalRecordError(record.id);
      }

      recordsById.set(record.id, this.copyRecord(record));
      order.push(record.id);
    }

    this.approvalRecordsById = recordsById;
    this.approvalOrder = order;
  }

  public list(context: TenantContext): readonly ApprovalRecord[] {
    return this.approvalOrder
      .map((approvalId) => this.approvalRecordsById.get(approvalId))
      .filter((record): record is ApprovalRecord => record !== undefined)
      .filter((record) => sameTenantStore(record, context))
      .map((record) => this.copyRecord(record));
  }

  public findById(context: TenantContext, approvalId: string): ApprovalRecord | undefined {
    const record = this.approvalRecordsById.get(approvalId);

    return record === undefined || !sameTenantStore(record, context) ? undefined : this.copyRecord(record);
  }

  public save(context: TenantContext, approval: ApprovalRecord, expectedVersion?: number): ApprovalRecord {
    if (!sameTenantStore(approval, context)) {
      throw new ApprovalTenantMismatchError(approval.id);
    }

    const stored = this.approvalRecordsById.get(approval.id);

    if (stored === undefined) {
      this.approvalRecordsById.set(approval.id, this.copyRecord(approval));
      return this.copyRecord(approval);
    }

    if (!sameTenantStore(stored, context)) {
      throw new ApprovalTenantMismatchError(approval.id);
    }

    if (expectedVersion !== undefined && stored.version !== expectedVersion) {
      throw new ApprovalVersionConflictError(approval.id);
    }

    this.approvalRecordsById.set(approval.id, this.copyRecord(approval));

    return this.copyRecord(approval);
  }

  private copyRecord(record: ApprovalRecord): ApprovalRecord {
    return { ...record };
  }
}

export class ApprovalTenantMismatchError extends Error {
  public constructor(approvalId: string) {
    super(`Approval ${approvalId} cannot be saved outside its tenant context.`);
    this.name = "ApprovalTenantMismatchError";
  }
}
