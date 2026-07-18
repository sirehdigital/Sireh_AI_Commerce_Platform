import {
  sameTenantStore,
  type AuditDetails,
  type AuditRecord,
  type AuditRepository,
  type TenantContext,
} from "../../application/index.js";

export class DuplicateAuditRecordError extends Error {
  public constructor(auditId: string) {
    super(`Audit record ${auditId} already exists.`);
    this.name = "DuplicateAuditRecordError";
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly auditRecords: AuditRecord[];
  private readonly auditRecordsById: Map<string, AuditRecord>;

  public constructor(initialRecords: readonly AuditRecord[] = []) {
    this.auditRecords = [];
    this.auditRecordsById = new Map<string, AuditRecord>();

    for (const record of initialRecords) {
      this.appendSeed(record);
    }
  }

  public list(context: TenantContext): readonly AuditRecord[] {
    return this.auditRecords
      .filter((record) => sameTenantStore(record, context))
      .map((record) => this.copyRecord(record));
  }

  public findById(context: TenantContext, auditId: string): AuditRecord | undefined {
    const record = this.auditRecordsById.get(auditId);

    return record === undefined || !sameTenantStore(record, context) ? undefined : this.copyRecord(record);
  }

  public append(context: TenantContext, record: AuditRecord): AuditRecord {
    if (!sameTenantStore(record, context)) {
      throw new AuditTenantMismatchError(record.id);
    }

    if (this.auditRecordsById.has(record.id)) {
      throw new DuplicateAuditRecordError(record.id);
    }

    const stored = this.copyRecord(record);
    this.auditRecords.push(stored);
    this.auditRecordsById.set(stored.id, stored);

    return this.copyRecord(stored);
  }

  private appendSeed(record: AuditRecord): void {
    this.append(record, record);
  }

  private copyRecord(record: AuditRecord): AuditRecord {
    return {
      ...record,
      details: this.copyDetails(record.details),
    };
  }

  private copyDetails(details: AuditDetails): AuditDetails {
    return { ...details };
  }
}

export class AuditTenantMismatchError extends Error {
  public constructor(auditId: string) {
    super(`Audit record ${auditId} cannot be appended outside its tenant context.`);
    this.name = "AuditTenantMismatchError";
  }
}
