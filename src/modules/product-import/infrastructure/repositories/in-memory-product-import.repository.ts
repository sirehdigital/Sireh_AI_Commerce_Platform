import type {
  ProductImportIdentity,
  ProductImportRecordUpdate,
  ProductImportRepository,
} from "../../domain/repositories/product-import.repository.js";
import type {
  ProductImportListQuery,
  ProductImportListResult,
  ProductImportPipelineResult,
  ProductImportRecord,
} from "../../domain/models/product-import.model.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export class InMemoryProductImportRepository implements ProductImportRepository {
  private readonly resultsByIdentity = new Map<string, ProductImportPipelineResult>();
  private readonly recordsById = new Map<string, ProductImportRecord>();
  private readonly recordIdsByIdempotencyKey = new Map<string, string>();
  private readonly recordIdsByIdentity = new Map<string, string>();
  private readonly recordOrder: string[] = [];

  public findByIdentity(identity: ProductImportIdentity): Promise<ProductImportPipelineResult | undefined> {
    const result = this.resultsByIdentity.get(this.toKey(identity));
    return Promise.resolve(result === undefined ? undefined : this.cloneResult(result));
  }

  public save(result: ProductImportPipelineResult): Promise<ProductImportPipelineResult> {
    const clonedResult = this.cloneResult(result);
    this.resultsByIdentity.set(
      this.toKey({ sourcePlatform: result.source.platform, externalProductId: result.source.externalProductId }),
      clonedResult,
    );

    return Promise.resolve(this.cloneResult(clonedResult));
  }

  public create(record: ProductImportRecord): Promise<ProductImportRecord> {
    const clonedRecord = this.cloneRecord(record);

    if (!this.recordsById.has(clonedRecord.importId)) {
      this.recordOrder.push(clonedRecord.importId);
    }

    this.recordsById.set(clonedRecord.importId, clonedRecord);
    this.recordIdsByIdempotencyKey.set(clonedRecord.idempotencyKey, clonedRecord.importId);
    this.recordIdsByIdentity.set(this.toRecordKey(clonedRecord), clonedRecord.importId);

    if (clonedRecord.resultSnapshot !== undefined) {
      this.resultsByIdentity.set(this.toRecordKey(clonedRecord), this.cloneResult(clonedRecord.resultSnapshot));
    }

    return Promise.resolve(this.cloneRecord(clonedRecord));
  }

  public update(importId: string, updates: ProductImportRecordUpdate): Promise<ProductImportRecord> {
    const existing = this.recordsById.get(importId);

    if (existing === undefined) {
      return Promise.reject(new ProductImportRecordNotFoundError(importId));
    }

    const updated: ProductImportRecord = {
      ...existing,
      ...updates,
      warnings: updates.warnings === undefined ? existing.warnings : [...updates.warnings],
      payload: updates.payload === undefined ? existing.payload : { ...updates.payload },
      updatedAt: new Date().toISOString(),
    };

    return this.create(updated);
  }

  public findById(importId: string): Promise<ProductImportRecord | undefined> {
    const record = this.recordsById.get(importId);
    return Promise.resolve(record === undefined ? undefined : this.cloneRecord(record));
  }

  public findByIdempotencyKey(idempotencyKey: string): Promise<ProductImportRecord | undefined> {
    const importId = this.recordIdsByIdempotencyKey.get(idempotencyKey.trim().toLowerCase());
    const record = importId === undefined ? undefined : this.recordsById.get(importId);

    return Promise.resolve(record === undefined ? undefined : this.cloneRecord(record));
  }

  public findRecordByIdentity(identity: ProductImportIdentity): Promise<ProductImportRecord | undefined> {
    const importId = this.recordIdsByIdentity.get(this.toKey(identity));
    const record = importId === undefined ? undefined : this.recordsById.get(importId);

    return Promise.resolve(record === undefined ? undefined : this.cloneRecord(record));
  }

  public list(query: ProductImportListQuery = {}): Promise<ProductImportListResult> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const filtered = this.recordOrder
      .map((importId) => this.recordsById.get(importId))
      .filter((record): record is ProductImportRecord => record !== undefined)
      .filter((record) => this.matches(record, query))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    const items = filtered.slice(offset, offset + limit).map((record) => this.cloneRecord(record));
    const nextOffset = offset + items.length;

    return Promise.resolve({
      items,
      total: filtered.length,
      limit,
      offset,
      hasNextPage: nextOffset < filtered.length,
      ...(nextOffset < filtered.length ? { nextOffset } : {}),
    });
  }

  public clear(): void {
    this.resultsByIdentity.clear();
    this.recordsById.clear();
    this.recordIdsByIdempotencyKey.clear();
    this.recordIdsByIdentity.clear();
    this.recordOrder.length = 0;
  }

  private matches(record: ProductImportRecord, query: ProductImportListQuery): boolean {
    return (
      (query.tenantId === undefined || record.tenantId === query.tenantId) &&
      (query.storeId === undefined || record.storeId === query.storeId) &&
      (query.shopDomain === undefined || record.shopDomain === query.shopDomain) &&
      (query.status === undefined || record.status === query.status) &&
      (query.sourcePlatform === undefined || record.sourcePlatform === query.sourcePlatform)
    );
  }

  private normalizeLimit(limit: number | undefined): number {
    if (limit === undefined) {
      return DEFAULT_LIMIT;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new ProductImportRepositoryError("INVALID_QUERY", "Product import list limit is outside the allowed range.");
    }

    return limit;
  }

  private normalizeOffset(offset: number | undefined): number {
    if (offset === undefined) {
      return 0;
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new ProductImportRepositoryError("INVALID_QUERY", "Product import list offset is outside the allowed range.");
    }

    return offset;
  }

  private toKey(identity: ProductImportIdentity): string {
    return [identity.tenantId ?? "tenant-default", identity.storeId ?? "store-default", identity.sourcePlatform, identity.externalProductId]
      .join(":")
      .trim()
      .toLowerCase();
  }

  private toRecordKey(record: ProductImportRecord): string {
    return this.toKey({
      tenantId: record.tenantId,
      storeId: record.storeId,
      sourcePlatform: record.sourcePlatform,
      externalProductId: record.externalProductId,
    });
  }

  private cloneRecord(record: ProductImportRecord): ProductImportRecord {
    return {
      ...record,
      warnings: [...record.warnings],
      payload: { ...record.payload },
      ...(record.resultSnapshot === undefined ? {} : { resultSnapshot: this.cloneResult(record.resultSnapshot) }),
    };
  }

  private cloneResult(result: ProductImportPipelineResult): ProductImportPipelineResult {
    return {
      ...result,
      source: { ...result.source },
      warnings: [...result.warnings],
      ...(result.failureReason === undefined
        ? {}
        : { failureReason: { ...result.failureReason, details: { ...result.failureReason.details } } }),
    };
  }
}

export class ProductImportRepositoryError extends Error {
  public constructor(
    public readonly code: "INVALID_QUERY" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "ProductImportRepositoryError";
  }
}

export class ProductImportRecordNotFoundError extends ProductImportRepositoryError {
  public constructor(importId: string) {
    super("NOT_FOUND", `Product import record ${importId} was not found.`);
  }
}
