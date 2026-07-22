import { prisma } from "../../../../database/prisma/prisma.client.js";
import type {
  ProductImportIdentity,
  ProductImportRecordUpdate,
  ProductImportRepository,
} from "../../domain/repositories/product-import.repository.js";
import type {
  ProductImportListQuery,
  ProductImportListResult,
  ProductImportPersistenceStatus,
  ProductImportPipelineResult,
  ProductImportPipelineStatus,
  ProductImportRecord,
  ProductImportSourcePlatform,
} from "../../domain/models/product-import.model.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

interface ProductImportStoredRecord {
  readonly importId: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly sourcePlatform: string;
  readonly externalProductId: string;
  readonly sourceUrl: string | null;
  readonly supplierName: string | null;
  readonly status: string;
  readonly pipelineStatus: string;
  readonly idempotencyKey: string;
  readonly idempotencyBehavior: string;
  readonly duplicate: boolean;
  readonly forced: boolean;
  readonly parentImportId: string | null;
  readonly productDraftId: string | null;
  readonly approvalId: string | null;
  readonly auditReference: string | null;
  readonly failureStage: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly warnings: unknown;
  readonly payload: unknown;
  readonly resultSnapshot: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

type ProductImportCreateData = Omit<ProductImportStoredRecord, "createdAt" | "updatedAt" | "completedAt"> & {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt?: Date | null;
};

type ProductImportUpdateData = Partial<Omit<ProductImportCreateData, "importId" | "tenantId" | "storeId" | "sourcePlatform" | "externalProductId">>;

interface ProductImportDelegate {
  create(args: { readonly data: ProductImportCreateData }): Promise<ProductImportStoredRecord>;
  update(args: {
    readonly where: { readonly importId: string };
    readonly data: ProductImportUpdateData;
  }): Promise<ProductImportStoredRecord>;
  findUnique(args: { readonly where: { readonly importId: string } }): Promise<ProductImportStoredRecord | null>;
  findFirst(args: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly orderBy?: Readonly<Record<string, "asc" | "desc">>;
  }): Promise<ProductImportStoredRecord | null>;
  findMany(args: {
    readonly where: Readonly<Record<string, unknown>>;
    readonly orderBy?: Readonly<Record<string, "asc" | "desc">>;
    readonly take?: number;
    readonly skip?: number;
  }): Promise<ProductImportStoredRecord[]>;
  count(args: { readonly where: Readonly<Record<string, unknown>> }): Promise<number>;
}

interface ProductImportPrismaClient {
  readonly productImport: ProductImportDelegate;
}

export class PrismaProductImportRepository implements ProductImportRepository {
  public constructor(private readonly delegate: ProductImportDelegate) {}

  public async findByIdentity(identity: ProductImportIdentity): Promise<ProductImportPipelineResult | undefined> {
    const record = await this.findRecordByIdentity(identity);

    return record?.resultSnapshot;
  }

  public save(result: ProductImportPipelineResult): Promise<ProductImportPipelineResult> {
    return Promise.resolve(this.cloneResult(result));
  }

  public async create(record: ProductImportRecord): Promise<ProductImportRecord> {
    const stored = await this.delegate.create({
      data: this.toCreateData(record),
    });

    return this.toRecord(stored);
  }

  public async update(importId: string, updates: ProductImportRecordUpdate): Promise<ProductImportRecord> {
    const stored = await this.delegate.update({
      where: { importId },
      data: this.toUpdateData(updates),
    });

    return this.toRecord(stored);
  }

  public async findById(importId: string): Promise<ProductImportRecord | undefined> {
    const stored = await this.delegate.findUnique({ where: { importId } });

    return stored === null ? undefined : this.toRecord(stored);
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<ProductImportRecord | undefined> {
    const stored = await this.delegate.findFirst({
      where: { idempotencyKey: idempotencyKey.trim().toLowerCase() },
      orderBy: { createdAt: "desc" },
    });

    return stored === null ? undefined : this.toRecord(stored);
  }

  public async findRecordByIdentity(identity: ProductImportIdentity): Promise<ProductImportRecord | undefined> {
    const stored = await this.delegate.findFirst({
      where: {
        tenantId: identity.tenantId ?? "tenant-default",
        storeId: identity.storeId ?? "store-default",
        sourcePlatform: identity.sourcePlatform,
        externalProductId: identity.externalProductId,
      },
      orderBy: { createdAt: "desc" },
    });

    return stored === null ? undefined : this.toRecord(stored);
  }

  public async list(query: ProductImportListQuery = {}): Promise<ProductImportListResult> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const where = this.toWhere(query);
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.delegate.count({ where }),
    ]);
    const nextOffset = offset + items.length;

    return {
      items: items.map((item) => this.toRecord(item)),
      total,
      limit,
      offset,
      hasNextPage: nextOffset < total,
      ...(nextOffset < total ? { nextOffset } : {}),
    };
  }

  private toWhere(query: ProductImportListQuery): Readonly<Record<string, unknown>> {
    return {
      ...(query.tenantId === undefined ? {} : { tenantId: query.tenantId }),
      ...(query.storeId === undefined ? {} : { storeId: query.storeId }),
      ...(query.shopDomain === undefined ? {} : { shopDomain: query.shopDomain }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.sourcePlatform === undefined ? {} : { sourcePlatform: query.sourcePlatform }),
    };
  }

  private toCreateData(record: ProductImportRecord): ProductImportCreateData {
    return {
      importId: record.importId,
      tenantId: record.tenantId,
      storeId: record.storeId,
      shopDomain: record.shopDomain ?? null,
      sourcePlatform: record.sourcePlatform,
      externalProductId: record.externalProductId,
      sourceUrl: record.sourceUrl ?? null,
      supplierName: record.supplierName ?? null,
      status: record.status,
      pipelineStatus: record.pipelineStatus,
      idempotencyKey: record.idempotencyKey,
      idempotencyBehavior: record.idempotencyBehavior,
      duplicate: record.duplicate,
      forced: record.forced,
      parentImportId: record.parentImportId ?? null,
      productDraftId: record.productDraftId ?? null,
      approvalId: record.approvalId ?? null,
      auditReference: record.auditReference ?? null,
      failureStage: record.failureStage ?? null,
      failureCode: record.failureCode ?? null,
      failureMessage: record.failureMessage ?? null,
      warnings: this.toJsonValue(record.warnings),
      payload: this.toJsonValue(record.payload),
      resultSnapshot: record.resultSnapshot === undefined ? null : this.toJsonValue(record.resultSnapshot),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      completedAt: record.completedAt === undefined ? null : new Date(record.completedAt),
    };
  }

  private toUpdateData(updates: ProductImportRecordUpdate): ProductImportUpdateData {
    return {
      ...(updates.status === undefined ? {} : { status: updates.status }),
      ...(updates.pipelineStatus === undefined ? {} : { pipelineStatus: updates.pipelineStatus }),
      ...(updates.productDraftId === undefined ? {} : { productDraftId: updates.productDraftId }),
      ...(updates.approvalId === undefined ? {} : { approvalId: updates.approvalId }),
      ...(updates.auditReference === undefined ? {} : { auditReference: updates.auditReference }),
      ...(updates.failureStage === undefined ? {} : { failureStage: updates.failureStage }),
      ...(updates.failureCode === undefined ? {} : { failureCode: updates.failureCode }),
      ...(updates.failureMessage === undefined ? {} : { failureMessage: updates.failureMessage }),
      ...(updates.warnings === undefined ? {} : { warnings: this.toJsonValue(updates.warnings) }),
      ...(updates.payload === undefined ? {} : { payload: this.toJsonValue(updates.payload) }),
      ...(updates.resultSnapshot === undefined ? {} : { resultSnapshot: this.toJsonValue(updates.resultSnapshot) }),
      ...(updates.completedAt === undefined ? {} : { completedAt: new Date(updates.completedAt) }),
      updatedAt: new Date(),
    };
  }

  private toRecord(stored: ProductImportStoredRecord): ProductImportRecord {
    return {
      importId: stored.importId,
      tenantId: stored.tenantId,
      storeId: stored.storeId,
      ...(stored.shopDomain === null ? {} : { shopDomain: stored.shopDomain as `${string}.myshopify.com` }),
      sourcePlatform: stored.sourcePlatform as ProductImportSourcePlatform,
      externalProductId: stored.externalProductId,
      ...(stored.sourceUrl === null ? {} : { sourceUrl: stored.sourceUrl }),
      ...(stored.supplierName === null ? {} : { supplierName: stored.supplierName }),
      status: stored.status as ProductImportPersistenceStatus,
      pipelineStatus: stored.pipelineStatus as ProductImportPipelineStatus,
      idempotencyKey: stored.idempotencyKey,
      idempotencyBehavior: stored.idempotencyBehavior as ProductImportRecord["idempotencyBehavior"],
      duplicate: stored.duplicate,
      forced: stored.forced,
      ...(stored.parentImportId === null ? {} : { parentImportId: stored.parentImportId }),
      ...(stored.productDraftId === null ? {} : { productDraftId: stored.productDraftId }),
      ...(stored.approvalId === null ? {} : { approvalId: stored.approvalId }),
      ...(stored.auditReference === null ? {} : { auditReference: stored.auditReference }),
      ...(stored.failureStage === null ? {} : { failureStage: stored.failureStage as ProductImportPipelineStatus }),
      ...(stored.failureCode === null ? {} : { failureCode: stored.failureCode }),
      ...(stored.failureMessage === null ? {} : { failureMessage: stored.failureMessage }),
      warnings: this.toStringArray(stored.warnings),
      payload: this.toRecordPayload(stored.payload),
      ...(stored.resultSnapshot === null ? {} : { resultSnapshot: stored.resultSnapshot as ProductImportPipelineResult }),
      createdAt: stored.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
      ...(stored.completedAt === null ? {} : { completedAt: stored.completedAt.toISOString() }),
    };
  }

  private normalizeLimit(limit: number | undefined): number {
    if (limit === undefined) {
      return DEFAULT_LIMIT;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new ProductImportPersistenceError("INVALID_QUERY", "Product import list limit is outside the allowed range.");
    }

    return limit;
  }

  private normalizeOffset(offset: number | undefined): number {
    if (offset === undefined) {
      return 0;
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new ProductImportPersistenceError("INVALID_QUERY", "Product import list offset is outside the allowed range.");
    }

    return offset;
  }

  private toJsonValue(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value)) as unknown;
  }

  private toStringArray(value: unknown): readonly string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  private toRecordPayload(value: unknown): Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
  }

  private cloneResult(result: ProductImportPipelineResult): ProductImportPipelineResult {
    return this.toJsonValue(result) as ProductImportPipelineResult;
  }
}

export class ProductImportPersistenceError extends Error {
  public constructor(
    public readonly code: "INVALID_QUERY",
    message: string,
  ) {
    super(message);
    this.name = "ProductImportPersistenceError";
  }
}

const productImportPrisma = prisma as unknown as ProductImportPrismaClient;

export const prismaProductImportRepository = new PrismaProductImportRepository(productImportPrisma.productImport);
