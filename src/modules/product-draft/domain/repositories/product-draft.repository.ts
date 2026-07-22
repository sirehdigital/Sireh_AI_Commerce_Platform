import type {
  ProductDraft,
  ProductDraftRiskLevel,
  ProductDraftSourceType,
  ProductDraftStatus,
} from "../models/product-draft.model.js";

export type ProductDraftRepositoryErrorCode =
  | "DUPLICATE_IDEMPOTENCY_KEY"
  | "DUPLICATE_SOURCE_REFERENCE"
  | "VERSION_CONFLICT"
  | "INVALID_QUERY"
  | "UNKNOWN";

export type ProductDraftRepositoryErrorMetadata = Readonly<Record<string, string | number | boolean | null>>;

export class ProductDraftRepositoryError extends Error {
  public readonly code: ProductDraftRepositoryErrorCode;
  public readonly metadata: ProductDraftRepositoryErrorMetadata;
  public override readonly cause?: unknown;

  public constructor(
    code: ProductDraftRepositoryErrorCode,
    message: string,
    metadata: ProductDraftRepositoryErrorMetadata = {},
    cause?: unknown,
  ) {
    super(message);
    this.name = "ProductDraftRepositoryError";
    this.code = code;
    this.metadata = { ...metadata };
    if (cause !== undefined) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ProductDraftRepositorySaveOptions {
  readonly idempotencyKey?: string;
}

export interface ProductDraftRepositorySaveResult {
  readonly draft: ProductDraft;
  readonly created: boolean;
  readonly updated: boolean;
}

export interface ProductDraftRepositoryListQuery {
  readonly status?: ProductDraftStatus;
  readonly sourceType?: ProductDraftSourceType;
  readonly riskLevel?: ProductDraftRiskLevel;
  readonly createdFrom?: string;
  readonly createdTo?: string;
  readonly updatedFrom?: string;
  readonly updatedTo?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ProductDraftRepositoryListResult {
  readonly items: readonly ProductDraft[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}

export interface ProductDraftRepository {
  save(draft: ProductDraft, options?: ProductDraftRepositorySaveOptions): Promise<ProductDraftRepositorySaveResult>;
  findById(id: string): Promise<ProductDraft | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<ProductDraft | null>;
  findBySourceReference(sourceType: ProductDraftSourceType, sourceId: string): Promise<ProductDraft | null>;
  existsById(id: string): Promise<boolean>;
  list(query?: ProductDraftRepositoryListQuery): Promise<ProductDraftRepositoryListResult>;
}
