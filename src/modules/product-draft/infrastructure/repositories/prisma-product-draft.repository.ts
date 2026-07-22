import { prisma } from "../../../../database/prisma/prisma.client.js";
import type { TenantContext } from "../../../saie/application/index.js";
import type {
  ProductDraft,
  ProductDraftSourceType,
} from "../../domain/models/product-draft.model.js";
import {
  ProductDraftRepositoryError,
  type ProductDraftRepository,
  type ProductDraftRepositoryListQuery,
  type ProductDraftRepositoryListResult,
  type ProductDraftRepositorySaveOptions,
  type ProductDraftRepositorySaveResult,
} from "../../domain/repositories/product-draft.repository.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

interface StoredProductDraft {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly status: string;
  readonly version: number;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceReferenceKey: string;
  readonly supplierId: string | null;
  readonly supplierProductId: string | null;
  readonly idempotencyKey: string | null;
  readonly title: string;
  readonly brand: string | null;
  readonly category: string | null;
  readonly productType: string | null;
  readonly currency: string | null;
  readonly riskLevel: string | null;
  readonly approvalId: string | null;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

interface ProductDraftDelegate {
  readonly findUnique: (args: unknown) => Promise<StoredProductDraft | null>;
  readonly findFirst: (args: unknown) => Promise<StoredProductDraft | null>;
  readonly create: (args: unknown) => Promise<StoredProductDraft>;
  readonly update: (args: unknown) => Promise<StoredProductDraft>;
  readonly count: (args: unknown) => Promise<number>;
  readonly findMany: (args: unknown) => Promise<readonly StoredProductDraft[]>;
}

const productDraftPrisma = prisma as unknown as { readonly productDraft: ProductDraftDelegate };

export class PrismaProductDraftRepository implements ProductDraftRepository {
  public constructor(
    private readonly delegate: ProductDraftDelegate,
    private readonly context: TenantContext,
  ) {}

  public async save(
    draft: ProductDraft,
    options: ProductDraftRepositorySaveOptions = {},
  ): Promise<ProductDraftRepositorySaveResult> {
    const existing = await this.delegate.findUnique({
      where: { id: draft.id },
    });
    const idempotencyKey = this.normalizeOptionalText(options.idempotencyKey);
    const sourceReferenceKey = this.toSourceReferenceKey(draft.source.sourceType, draft.source.sourceId);

    this.assertTenantWritable(existing, draft.id);
    await this.assertUniqueIdempotencyKey(draft.id, idempotencyKey);
    await this.assertUniqueSourceReference(draft.id, sourceReferenceKey);

    if (existing !== null) {
      this.assertVersionCanBeSaved(existing, draft);
      const storedDraft = this.toDraft(existing);
      if (draft.version === existing.version && this.stableJson(storedDraft) === this.stableJson(draft)) {
        return { draft: storedDraft, created: false, updated: false };
      }
    }

    const data = this.toCreateData(draft, idempotencyKey, sourceReferenceKey);
    const saved = existing === null
      ? await this.delegate.create({ data })
      : await this.delegate.update({ where: { id: draft.id }, data });

    return {
      draft: this.toDraft(saved),
      created: existing === null,
      updated: existing !== null,
    };
  }

  public async findById(id: string): Promise<ProductDraft | null> {
    const record = await this.delegate.findFirst({
      where: {
        id: id.trim(),
        tenantId: this.context.tenantId,
        storeId: this.context.storeId,
      },
    });

    return record === null ? null : this.toDraft(record);
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<ProductDraft | null> {
    const key = this.normalizeOptionalText(idempotencyKey);
    if (key === undefined) {
      return null;
    }

    const record = await this.delegate.findFirst({
      where: {
        tenantId: this.context.tenantId,
        storeId: this.context.storeId,
        idempotencyKey: key,
      },
    });

    return record === null ? null : this.toDraft(record);
  }

  public async findBySourceReference(
    sourceType: ProductDraftSourceType,
    sourceId: string,
  ): Promise<ProductDraft | null> {
    const record = await this.delegate.findFirst({
      where: {
        tenantId: this.context.tenantId,
        storeId: this.context.storeId,
        sourceReferenceKey: this.toSourceReferenceKey(sourceType, sourceId),
      },
    });

    return record === null ? null : this.toDraft(record);
  }

  public async existsById(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  public async list(query: ProductDraftRepositoryListQuery = {}): Promise<ProductDraftRepositoryListResult> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const where = this.toWhere(query);
    const [total, records] = await Promise.all([
      this.delegate.count({ where }),
      this.delegate.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: offset,
        take: limit,
      }),
    ]);
    const nextOffset = offset + records.length;
    const hasNextPage = nextOffset < total;

    return {
      items: records.map((record) => this.toDraft(record)),
      total,
      limit,
      offset,
      hasNextPage,
      ...(hasNextPage ? { nextOffset } : {}),
    };
  }

  private async assertUniqueIdempotencyKey(id: string, idempotencyKey: string | undefined): Promise<void> {
    if (idempotencyKey === undefined) {
      return;
    }

    const existing = await this.delegate.findFirst({
      where: {
        tenantId: this.context.tenantId,
        storeId: this.context.storeId,
        idempotencyKey,
        NOT: { id },
      },
    });

    if (existing !== null) {
      throw new ProductDraftRepositoryError("DUPLICATE_IDEMPOTENCY_KEY", "Product Draft idempotency key is already assigned.", {
        draftId: id,
        existingDraftId: existing.id,
      });
    }
  }

  private async assertUniqueSourceReference(id: string, sourceReferenceKey: string): Promise<void> {
    const existing = await this.delegate.findFirst({
      where: {
        tenantId: this.context.tenantId,
        storeId: this.context.storeId,
        sourceReferenceKey,
        NOT: { id },
      },
    });

    if (existing !== null) {
      throw new ProductDraftRepositoryError("DUPLICATE_SOURCE_REFERENCE", "Product Draft source reference is already assigned.", {
        draftId: id,
        existingDraftId: existing.id,
      });
    }
  }

  private assertTenantWritable(existing: StoredProductDraft | null, draftId: string): void {
    if (existing !== null && (existing.tenantId !== this.context.tenantId || existing.storeId !== this.context.storeId)) {
      throw new ProductDraftRepositoryError("UNKNOWN", "Product Draft cannot be saved outside its tenant context.", {
        draftId,
      });
    }
  }

  private assertVersionCanBeSaved(existing: StoredProductDraft, draft: ProductDraft): void {
    if (draft.version < existing.version) {
      throw new ProductDraftRepositoryError("VERSION_CONFLICT", "Product Draft version is stale.", {
        draftId: draft.id,
        incomingVersion: draft.version,
        storedVersion: existing.version,
      });
    }

    if (draft.version === existing.version && this.stableJson(this.toDraft(existing)) !== this.stableJson(draft)) {
      throw new ProductDraftRepositoryError("VERSION_CONFLICT", "Product Draft version cannot overwrite different content.", {
        draftId: draft.id,
        version: draft.version,
      });
    }
  }

  private toCreateData(draft: ProductDraft, idempotencyKey: string | undefined, sourceReferenceKey: string): Record<string, unknown> {
    return {
      id: draft.id,
      tenantId: this.context.tenantId,
      storeId: this.context.storeId,
      shopDomain: this.context.shopDomain ?? null,
      status: draft.status,
      version: draft.version,
      sourceType: draft.source.sourceType,
      sourceId: draft.source.sourceId,
      sourceReferenceKey,
      supplierId: draft.source.supplierId ?? null,
      supplierProductId: draft.source.supplierProductId ?? null,
      idempotencyKey: idempotencyKey ?? null,
      title: draft.title,
      brand: draft.branding?.brandName ?? draft.brand ?? null,
      category: draft.category ?? draft.branding?.collectionName ?? null,
      productType: draft.productType ?? null,
      currency: draft.variants[0]?.sellingPrice.currency ?? null,
      riskLevel: draft.riskAssessment?.level ?? null,
      approvalId: draft.approval?.approvalId ?? null,
      payload: this.cloneJson(draft),
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
      archivedAt: draft.archivedAt === undefined ? null : new Date(draft.archivedAt),
    };
  }

  private toWhere(query: ProductDraftRepositoryListQuery): Record<string, unknown> {
    return {
      tenantId: this.context.tenantId,
      storeId: this.context.storeId,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.sourceType === undefined ? {} : { sourceType: query.sourceType }),
      ...(query.riskLevel === undefined ? {} : { riskLevel: query.riskLevel }),
      ...this.dateRange("createdAt", query.createdFrom, query.createdTo),
      ...this.dateRange("updatedAt", query.updatedFrom, query.updatedTo),
    };
  }

  private dateRange(field: string, from: string | undefined, to: string | undefined): Record<string, unknown> {
    if (from === undefined && to === undefined) {
      return {};
    }

    return {
      [field]: {
        ...(from === undefined ? {} : { gte: this.parseDate(from, "from") }),
        ...(to === undefined ? {} : { lte: this.parseDate(to, "to") }),
      },
    };
  }

  private toDraft(record: StoredProductDraft): ProductDraft {
    return this.cloneJson(record.payload) as ProductDraft;
  }

  private normalizeLimit(limit: number | undefined): number {
    if (limit === undefined) {
      return DEFAULT_LIST_LIMIT;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      throw new ProductDraftRepositoryError("INVALID_QUERY", "Product Draft list limit is outside the allowed range.", {
        limit,
        maximumLimit: MAX_LIST_LIMIT,
      });
    }

    return limit;
  }

  private normalizeOffset(offset: number | undefined): number {
    if (offset === undefined) {
      return 0;
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new ProductDraftRepositoryError("INVALID_QUERY", "Product Draft list offset is outside the allowed range.", {
        offset,
      });
    }

    return offset;
  }

  private parseDate(value: string, field: string): Date {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      throw new ProductDraftRepositoryError("INVALID_QUERY", "Product Draft list query has an invalid date.", { field });
    }

    return new Date(parsed);
  }

  private toSourceReferenceKey(sourceType: ProductDraftSourceType, sourceId: string): string {
    return `${sourceType}:${sourceId.trim().toLowerCase()}`;
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized === undefined || normalized.length === 0 ? undefined : normalized;
  }

  private stableJson(value: unknown): string {
    return JSON.stringify(this.cloneJson(value));
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export const createPrismaProductDraftRepository = (context: TenantContext): PrismaProductDraftRepository =>
  new PrismaProductDraftRepository(productDraftPrisma.productDraft, context);
