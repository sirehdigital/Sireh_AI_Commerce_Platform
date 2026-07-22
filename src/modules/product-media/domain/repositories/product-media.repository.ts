import type {
  ProductMediaAsset,
  ProductMediaJob,
  ProductMediaJobStatus,
  ProductMediaJobWithAssets,
} from "../models/index.js";

export interface ProductMediaJobListQuery {
  readonly tenantId?: string;
  readonly storeId?: string;
  readonly productDraftId?: string;
  readonly status?: ProductMediaJobStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ProductMediaJobListResult {
  readonly items: readonly ProductMediaJob[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}

export interface ProductMediaRepository {
  createJob(job: ProductMediaJob, assets: readonly ProductMediaAsset[]): Promise<ProductMediaJobWithAssets>;
  updateJob(jobId: string, updates: Partial<ProductMediaJob>): Promise<ProductMediaJob>;
  replaceAssets(jobId: string, assets: readonly ProductMediaAsset[]): Promise<readonly ProductMediaAsset[]>;
  findJobById(jobId: string): Promise<ProductMediaJob | undefined>;
  findJobWithAssets(jobId: string): Promise<ProductMediaJobWithAssets | undefined>;
  findEligibleByIdempotencyKey(input: {
    readonly tenantId: string;
    readonly storeId: string;
    readonly idempotencyKey: string;
  }): Promise<ProductMediaJobWithAssets | undefined>;
  listJobs(query?: ProductMediaJobListQuery): Promise<ProductMediaJobListResult>;
  listAssets(jobId: string): Promise<readonly ProductMediaAsset[]>;
}
