import type { ProductMediaAsset, ProductMediaJob, ProductMediaJobWithAssets } from "../../domain/models/index.js";
import type { ProductMediaJobListQuery, ProductMediaJobListResult, ProductMediaRepository } from "../../domain/repositories/index.js";

const DEFAULT_LIMIT = 50;

export class InMemoryProductMediaRepository implements ProductMediaRepository {
  private readonly jobs = new Map<string, ProductMediaJob>();
  private readonly assetsByJobId = new Map<string, ProductMediaAsset[]>();

  public createJob(job: ProductMediaJob, assets: readonly ProductMediaAsset[]): Promise<ProductMediaJobWithAssets> {
    const storedJob = this.clone(job);
    const storedAssets = assets.map((asset) => this.clone(asset));
    this.jobs.set(job.id, storedJob);
    this.assetsByJobId.set(job.id, storedAssets);
    return Promise.resolve({ job: this.clone(storedJob), assets: storedAssets.map((asset) => this.clone(asset)) });
  }

  public updateJob(jobId: string, updates: Partial<ProductMediaJob>): Promise<ProductMediaJob> {
    const existing = this.jobs.get(jobId);
    if (existing === undefined) {
      return Promise.reject(new Error(`Product media job ${jobId} was not found.`));
    }
    const updated = { ...existing, ...updates };
    this.jobs.set(jobId, updated);
    return Promise.resolve(this.clone(updated));
  }

  public replaceAssets(jobId: string, assets: readonly ProductMediaAsset[]): Promise<readonly ProductMediaAsset[]> {
    const storedAssets = assets.map((asset) => this.clone(asset));
    this.assetsByJobId.set(jobId, storedAssets);
    return Promise.resolve(storedAssets.map((asset) => this.clone(asset)));
  }

  public findJobById(jobId: string): Promise<ProductMediaJob | undefined> {
    const job = this.jobs.get(jobId);
    return Promise.resolve(job === undefined ? undefined : this.clone(job));
  }

  public findJobWithAssets(jobId: string): Promise<ProductMediaJobWithAssets | undefined> {
    const job = this.jobs.get(jobId);
    if (job === undefined) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve({
      job: this.clone(job),
      assets: (this.assetsByJobId.get(jobId) ?? []).map((asset) => this.clone(asset)),
    });
  }

  public findEligibleByIdempotencyKey(input: {
    readonly tenantId: string;
    readonly storeId: string;
    readonly idempotencyKey: string;
  }): Promise<ProductMediaJobWithAssets | undefined> {
    const job = [...this.jobs.values()]
      .filter((candidate) =>
        candidate.tenantId === input.tenantId &&
        candidate.storeId === input.storeId &&
        candidate.idempotencyKey === input.idempotencyKey &&
        candidate.status !== "FAILED" &&
        candidate.status !== "CANCELLED",
      )
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))[0];

    return job === undefined ? Promise.resolve(undefined) : this.findJobWithAssets(job.id);
  }

  public listJobs(query: ProductMediaJobListQuery = {}): Promise<ProductMediaJobListResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const filtered = [...this.jobs.values()]
      .filter((job) => this.matches(job, query))
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    const items = filtered.slice(offset, offset + limit).map((job) => this.clone(job));
    const nextOffset = offset + items.length;
    const hasNextPage = nextOffset < filtered.length;

    return Promise.resolve({
      items,
      total: filtered.length,
      limit,
      offset,
      hasNextPage,
      ...(hasNextPage ? { nextOffset } : {}),
    });
  }

  public listAssets(jobId: string): Promise<readonly ProductMediaAsset[]> {
    return Promise.resolve((this.assetsByJobId.get(jobId) ?? []).map((asset) => this.clone(asset)));
  }

  private matches(job: ProductMediaJob, query: ProductMediaJobListQuery): boolean {
    return (
      (query.tenantId === undefined || job.tenantId === query.tenantId) &&
      (query.storeId === undefined || job.storeId === query.storeId) &&
      (query.productDraftId === undefined || job.productDraftId === query.productDraftId) &&
      (query.status === undefined || job.status === query.status)
    );
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
