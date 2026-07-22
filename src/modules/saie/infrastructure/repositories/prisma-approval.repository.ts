import { prisma } from "../../../../database/prisma/prisma.client.js";
import {
  ApprovalVersionConflictError,
  sameTenantStore,
  type ApprovalRecord,
  type TenantContext,
} from "../../application/index.js";

interface StoredApprovalRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly proposalId: string;
  readonly workflowId: string | null;
  readonly title: string;
  readonly status: string;
  readonly riskLevel: string;
  readonly requestedBy: string;
  readonly decidedBy: string | null;
  readonly decisionReason: string | null;
  readonly requiresHumanApproval: boolean;
  readonly executionEnabled: boolean;
  readonly source: string;
  readonly version: number;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly requestedAt: Date;
  readonly decidedAt: Date | null;
  readonly updatedAt: Date;
}

interface ApprovalDelegate {
  readonly findUnique: (args: unknown) => Promise<StoredApprovalRecord | null>;
  readonly findFirst: (args: unknown) => Promise<StoredApprovalRecord | null>;
  readonly findMany: (args: unknown) => Promise<readonly StoredApprovalRecord[]>;
  readonly create: (args: unknown) => Promise<StoredApprovalRecord>;
  readonly update: (args: unknown) => Promise<StoredApprovalRecord>;
}

const approvalPrisma = prisma as unknown as { readonly approvalRecord: ApprovalDelegate };

export class PrismaApprovalRepository {
  public constructor(private readonly delegate: ApprovalDelegate) {}

  public async list(context: TenantContext): Promise<readonly ApprovalRecord[]> {
    const records = await this.delegate.findMany({
      where: { tenantId: context.tenantId, storeId: context.storeId },
      orderBy: [{ requestedAt: "desc" }, { id: "asc" }],
    });

    return records.map((record) => this.toRecord(record));
  }

  public async findById(context: TenantContext, approvalId: string): Promise<ApprovalRecord | undefined> {
    const record = await this.delegate.findFirst({
      where: {
        id: approvalId,
        tenantId: context.tenantId,
        storeId: context.storeId,
      },
    });

    return record === null ? undefined : this.toRecord(record);
  }

  public async save(
    context: TenantContext,
    approval: ApprovalRecord,
    expectedVersion?: number,
  ): Promise<ApprovalRecord> {
    if (!sameTenantStore(approval, context)) {
      throw new PrismaApprovalTenantMismatchError(approval.id);
    }

    const existing = await this.delegate.findUnique({ where: { id: approval.id } });
    if (existing !== null && (existing.tenantId !== context.tenantId || existing.storeId !== context.storeId)) {
      throw new PrismaApprovalTenantMismatchError(approval.id);
    }

    if (existing !== null && expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new ApprovalVersionConflictError(approval.id);
    }

    const data = this.toData(approval);
    const saved = existing === null
      ? await this.delegate.create({ data })
      : await this.delegate.update({ where: { id: approval.id }, data });

    return this.toRecord(saved);
  }

  private toData(record: ApprovalRecord): Record<string, unknown> {
    return {
      id: record.id,
      tenantId: record.tenantId,
      storeId: record.storeId,
      shopDomain: record.shopDomain ?? null,
      proposalId: record.proposalId,
      workflowId: record.workflowId ?? null,
      title: record.title,
      status: record.status,
      riskLevel: record.riskLevel,
      requestedBy: record.requestedBy,
      decidedBy: record.decidedBy ?? null,
      decisionReason: record.decisionReason ?? null,
      requiresHumanApproval: record.requiresHumanApproval,
      executionEnabled: record.executionEnabled,
      source: record.source,
      version: record.version,
      payload: this.cloneJson(record),
      createdAt: new Date(record.createdAt),
      requestedAt: new Date(record.requestedAt),
      decidedAt: record.decidedAt === undefined ? null : new Date(record.decidedAt),
    };
  }

  private toRecord(record: StoredApprovalRecord): ApprovalRecord {
    return this.cloneJson(record.payload) as ApprovalRecord;
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export class PrismaApprovalTenantMismatchError extends Error {
  public constructor(approvalId: string) {
    super(`Approval ${approvalId} cannot be saved outside its tenant context.`);
    this.name = "PrismaApprovalTenantMismatchError";
  }
}

export const prismaApprovalRepository = new PrismaApprovalRepository(approvalPrisma.approvalRecord);
