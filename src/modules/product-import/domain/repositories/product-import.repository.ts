import type {
  ProductImportListQuery,
  ProductImportListResult,
  ProductImportPersistenceStatus,
  ProductImportPipelineResult,
  ProductImportRecord,
  ProductImportSourcePlatform,
} from "../models/product-import.model.js";

export interface ProductImportIdentity {
  readonly sourcePlatform: ProductImportSourcePlatform;
  readonly externalProductId: string;
  readonly tenantId?: string;
  readonly storeId?: string;
}

export interface ProductImportRecordUpdate {
  readonly status?: ProductImportPersistenceStatus;
  readonly pipelineStatus?: ProductImportPipelineResult["finalPipelineStatus"];
  readonly productDraftId?: string;
  readonly approvalId?: string;
  readonly auditReference?: string;
  readonly failureStage?: ProductImportPipelineResult["failureReason"] extends infer Reason
    ? Reason extends { readonly stage: infer Stage }
      ? Stage
      : never
    : never;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly warnings?: readonly string[];
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly resultSnapshot?: ProductImportPipelineResult;
  readonly completedAt?: string;
}

export interface ProductImportRepository {
  findByIdentity(identity: ProductImportIdentity): Promise<ProductImportPipelineResult | undefined>;
  save(result: ProductImportPipelineResult): Promise<ProductImportPipelineResult>;
  create(record: ProductImportRecord): Promise<ProductImportRecord>;
  update(importId: string, updates: ProductImportRecordUpdate): Promise<ProductImportRecord>;
  findById(importId: string): Promise<ProductImportRecord | undefined>;
  findByIdempotencyKey(idempotencyKey: string): Promise<ProductImportRecord | undefined>;
  findRecordByIdentity(identity: ProductImportIdentity): Promise<ProductImportRecord | undefined>;
  list(query?: ProductImportListQuery): Promise<ProductImportListResult>;
}
