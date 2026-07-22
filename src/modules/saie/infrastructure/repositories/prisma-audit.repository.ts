import { prisma } from "../../../../database/prisma/prisma.client.js";
import { sameTenantStore, type AuditDetails, type AuditRecord, type TenantContext } from "../../application/index.js";

interface StoredAuditRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly actor: string;
  readonly summary: string;
  readonly source: string;
  readonly sequence: number;
  readonly correlationId: string | null;
  readonly activityType: string | null;
  readonly status: string | null;
  readonly details: unknown;
  readonly payload: unknown;
  readonly occurredAt: Date;
  readonly recordedAt: Date | null;
  readonly createdAt: Date;
}

interface AuditDelegate {
  readonly findUnique: (args: unknown) => Promise<StoredAuditRecord | null>;
  readonly findFirst: (args: unknown) => Promise<StoredAuditRecord | null>;
  readonly findMany: (args: unknown) => Promise<readonly StoredAuditRecord[]>;
  readonly create: (args: unknown) => Promise<StoredAuditRecord>;
}

const auditPrisma = prisma as unknown as { readonly auditRecord: AuditDelegate };

export class PrismaAuditRepository {
  public constructor(private readonly delegate: AuditDelegate) {}

  public async list(context: TenantContext): Promise<readonly AuditRecord[]> {
    const records = await this.delegate.findMany({
      where: { tenantId: context.tenantId, storeId: context.storeId },
      orderBy: [{ occurredAt: "asc" }, { sequence: "asc" }, { id: "asc" }],
    });

    return records.map((record) => this.toRecord(record));
  }

  public async findById(context: TenantContext, auditId: string): Promise<AuditRecord | undefined> {
    const record = await this.delegate.findFirst({
      where: {
        id: auditId,
        tenantId: context.tenantId,
        storeId: context.storeId,
      },
    });

    return record === null ? undefined : this.toRecord(record);
  }

  public async append(context: TenantContext, record: AuditRecord): Promise<AuditRecord> {
    if (!sameTenantStore(record, context)) {
      throw new PrismaAuditTenantMismatchError(record.id);
    }

    const existing = await this.delegate.findUnique({ where: { id: record.id } });
    if (existing !== null) {
      throw new PrismaDuplicateAuditRecordError(record.id);
    }

    const saved = await this.delegate.create({ data: this.toData(record) });
    return this.toRecord(saved);
  }

  private toData(record: AuditRecord): Record<string, unknown> {
    const safeRecord: AuditRecord = {
      ...record,
      details: this.redactDetails(record.details),
    };

    return {
      id: safeRecord.id,
      tenantId: safeRecord.tenantId,
      storeId: safeRecord.storeId,
      shopDomain: safeRecord.shopDomain ?? null,
      eventType: safeRecord.eventType,
      entityType: safeRecord.entityType,
      entityId: safeRecord.entityId,
      actor: safeRecord.actor,
      summary: safeRecord.summary,
      source: safeRecord.source,
      sequence: safeRecord.sequence,
      correlationId: safeRecord.correlationId ?? null,
      activityType: safeRecord.activityType ?? null,
      status: safeRecord.status ?? null,
      details: this.cloneJson(safeRecord.details),
      payload: this.cloneJson(safeRecord),
      occurredAt: new Date(safeRecord.occurredAt),
      recordedAt: safeRecord.recordedAt === undefined ? null : new Date(safeRecord.recordedAt),
    };
  }

  private toRecord(record: StoredAuditRecord): AuditRecord {
    return this.cloneJson(record.payload) as AuditRecord;
  }

  private redactDetails(details: AuditDetails): AuditDetails {
    return Object.fromEntries(
      Object.entries(details).map(([key, value]) => [
        key,
        /token|secret|password|credential|authorization|api[-_]?key/iu.test(key) ? "[REDACTED]" : value,
      ]),
    );
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export class PrismaDuplicateAuditRecordError extends Error {
  public constructor(auditId: string) {
    super(`Audit record ${auditId} already exists.`);
    this.name = "PrismaDuplicateAuditRecordError";
  }
}

export class PrismaAuditTenantMismatchError extends Error {
  public constructor(auditId: string) {
    super(`Audit record ${auditId} cannot be appended outside its tenant context.`);
    this.name = "PrismaAuditTenantMismatchError";
  }
}

export const prismaAuditRepository = new PrismaAuditRepository(auditPrisma.auditRecord);
