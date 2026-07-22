import { prisma } from "../../../../database/prisma/prisma.client.js";
import type { ProductMediaAsset, ProductMediaJob, ProductMediaJobWithAssets } from "../../domain/models/index.js";
import type { ProductMediaJobListQuery, ProductMediaJobListResult, ProductMediaRepository } from "../../domain/repositories/index.js";

interface StoredProductMediaJob {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain: string | null;
  readonly productDraftId: string;
  readonly importId: string | null;
  readonly parentJobId: string | null;
  readonly idempotencyKey: string;
  readonly mode: string;
  readonly status: string;
  readonly providerId: string | null;
  readonly brandProfileSnapshot: unknown;
  readonly planSnapshot: unknown;
  readonly qualityReportSnapshot: unknown;
  readonly warnings: unknown;
  readonly failureStage: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly approvalId: string | null;
  readonly auditReference: string | null;
  readonly correlationId: string | null;
  readonly forced: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

interface StoredProductMediaAsset {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly mediaJobId: string;
  readonly assetType: string;
  readonly purpose: string;
  readonly status: string;
  readonly aspectRatio: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly promptSnapshot: unknown;
  readonly negativePrompt: string | null;
  readonly sourceAssetReferences: unknown;
  readonly providerId: string | null;
  readonly providerReference: string | null;
  readonly storageKey: string | null;
  readonly outputUrl: string | null;
  readonly altText: string;
  readonly reviewNotes: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface ProductMediaJobDelegate {
  readonly create: (args: unknown) => Promise<StoredProductMediaJob>;
  readonly update: (args: unknown) => Promise<StoredProductMediaJob>;
  readonly findUnique: (args: unknown) => Promise<StoredProductMediaJob | null>;
  readonly findFirst: (args: unknown) => Promise<StoredProductMediaJob | null>;
  readonly findMany: (args: unknown) => Promise<readonly StoredProductMediaJob[]>;
  readonly count: (args: unknown) => Promise<number>;
}

interface ProductMediaAssetDelegate {
  readonly createMany: (args: unknown) => Promise<unknown>;
  readonly deleteMany: (args: unknown) => Promise<unknown>;
  readonly findMany: (args: unknown) => Promise<readonly StoredProductMediaAsset[]>;
}

const productMediaPrisma = prisma as unknown as {
  readonly productMediaJob: ProductMediaJobDelegate;
  readonly productMediaAsset: ProductMediaAssetDelegate;
};

export class PrismaProductMediaRepository implements ProductMediaRepository {
  public constructor(
    private readonly jobDelegate: ProductMediaJobDelegate,
    private readonly assetDelegate: ProductMediaAssetDelegate,
  ) {}

  public async createJob(job: ProductMediaJob, assets: readonly ProductMediaAsset[]): Promise<ProductMediaJobWithAssets> {
    const storedJob = await this.jobDelegate.create({ data: this.toJobData(job) });
    await this.assetDelegate.createMany({ data: assets.map((asset) => this.toAssetData(asset)) });
    return {
      job: this.toJob(storedJob),
      assets: await this.listAssets(job.id),
    };
  }

  public async updateJob(jobId: string, updates: Partial<ProductMediaJob>): Promise<ProductMediaJob> {
    const stored = await this.jobDelegate.update({ where: { id: jobId }, data: this.toJobUpdateData(updates) });
    return this.toJob(stored);
  }

  public async replaceAssets(jobId: string, assets: readonly ProductMediaAsset[]): Promise<readonly ProductMediaAsset[]> {
    await this.assetDelegate.deleteMany({ where: { mediaJobId: jobId } });
    await this.assetDelegate.createMany({ data: assets.map((asset) => this.toAssetData(asset)) });
    return this.listAssets(jobId);
  }

  public async findJobById(jobId: string): Promise<ProductMediaJob | undefined> {
    const job = await this.jobDelegate.findUnique({ where: { id: jobId } });
    return job === null ? undefined : this.toJob(job);
  }

  public async findJobWithAssets(jobId: string): Promise<ProductMediaJobWithAssets | undefined> {
    const job = await this.findJobById(jobId);
    if (job === undefined) {
      return undefined;
    }

    return { job, assets: await this.listAssets(jobId) };
  }

  public async findEligibleByIdempotencyKey(input: {
    readonly tenantId: string;
    readonly storeId: string;
    readonly idempotencyKey: string;
  }): Promise<ProductMediaJobWithAssets | undefined> {
    const job = await this.jobDelegate.findFirst({
      where: {
        tenantId: input.tenantId,
        storeId: input.storeId,
        idempotencyKey: input.idempotencyKey,
        status: { notIn: ["FAILED", "CANCELLED"] },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return job === null ? undefined : this.findJobWithAssets(job.id);
  }

  public async listJobs(query: ProductMediaJobListQuery = {}): Promise<ProductMediaJobListResult> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = {
      ...(query.tenantId === undefined ? {} : { tenantId: query.tenantId }),
      ...(query.storeId === undefined ? {} : { storeId: query.storeId }),
      ...(query.productDraftId === undefined ? {} : { productDraftId: query.productDraftId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };
    const [total, jobs] = await Promise.all([
      this.jobDelegate.count({ where }),
      this.jobDelegate.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: offset, take: limit }),
    ]);
    const nextOffset = offset + jobs.length;
    const hasNextPage = nextOffset < total;
    return {
      items: jobs.map((job) => this.toJob(job)),
      total,
      limit,
      offset,
      hasNextPage,
      ...(hasNextPage ? { nextOffset } : {}),
    };
  }

  public async listAssets(jobId: string): Promise<readonly ProductMediaAsset[]> {
    const assets = await this.assetDelegate.findMany({ where: { mediaJobId: jobId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return assets.map((asset) => this.toAsset(asset));
  }

  private toJobData(job: ProductMediaJob): Record<string, unknown> {
    return {
      id: job.id,
      tenantId: job.tenantId,
      storeId: job.storeId,
      shopDomain: job.shopDomain ?? null,
      productDraftId: job.productDraftId,
      importId: job.importId ?? null,
      parentJobId: job.parentJobId ?? null,
      idempotencyKey: job.idempotencyKey,
      mode: job.mode,
      status: job.status,
      providerId: job.providerId ?? null,
      brandProfileSnapshot: this.clone(job.brandProfileSnapshot),
      planSnapshot: this.clone(job.planSnapshot),
      qualityReportSnapshot: this.clone(job.qualityReportSnapshot),
      warnings: [...job.warnings],
      failureStage: job.failureStage ?? null,
      failureCode: job.failureCode ?? null,
      failureMessage: job.failureMessage ?? null,
      approvalId: job.approvalId ?? null,
      auditReference: job.auditReference ?? null,
      correlationId: job.correlationId ?? null,
      forced: job.forced,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
      completedAt: job.completedAt === undefined ? null : new Date(job.completedAt),
    };
  }

  private toJobUpdateData(updates: Partial<ProductMediaJob>): Record<string, unknown> {
    const mergedJob: ProductMediaJob = { ...this.emptyJob(), ...updates };
    return Object.fromEntries(
      Object.entries(this.toJobData(mergedJob))
        .filter(([key]) => key !== "id" && key in updates),
    );
  }

  private toAssetData(asset: ProductMediaAsset): Record<string, unknown> {
    return {
      id: asset.id,
      tenantId: asset.tenantId,
      storeId: asset.storeId,
      mediaJobId: asset.mediaJobId,
      assetType: asset.assetType,
      purpose: asset.purpose,
      status: asset.status,
      aspectRatio: asset.aspectRatio,
      width: asset.width,
      height: asset.height,
      format: asset.format,
      promptSnapshot: this.clone(asset.promptSnapshot),
      negativePrompt: asset.negativePrompt ?? null,
      sourceAssetReferences: [...asset.sourceAssetReferences],
      providerId: asset.providerId ?? null,
      providerReference: asset.providerReference ?? null,
      storageKey: asset.storageKey ?? null,
      outputUrl: asset.outputUrl ?? null,
      altText: asset.altText,
      reviewNotes: asset.reviewNotes ?? null,
      failureCode: asset.failureCode ?? null,
      failureMessage: asset.failureMessage ?? null,
      createdAt: new Date(asset.createdAt),
      updatedAt: new Date(asset.updatedAt),
    };
  }

  private toJob(record: StoredProductMediaJob): ProductMediaJob {
    return {
      id: record.id,
      tenantId: record.tenantId,
      storeId: record.storeId,
      ...(record.shopDomain === null ? {} : { shopDomain: record.shopDomain }),
      productDraftId: record.productDraftId,
      ...(record.importId === null ? {} : { importId: record.importId }),
      ...(record.parentJobId === null ? {} : { parentJobId: record.parentJobId }),
      idempotencyKey: record.idempotencyKey,
      mode: record.mode as ProductMediaJob["mode"],
      status: record.status as ProductMediaJob["status"],
      ...(record.providerId === null ? {} : { providerId: record.providerId }),
      brandProfileSnapshot: this.clone(record.brandProfileSnapshot) as ProductMediaJob["brandProfileSnapshot"],
      planSnapshot: this.clone(record.planSnapshot) as ProductMediaJob["planSnapshot"],
      qualityReportSnapshot: this.clone(record.qualityReportSnapshot) as ProductMediaJob["qualityReportSnapshot"],
      warnings: this.clone(record.warnings) as readonly string[],
      ...(record.failureStage === null ? {} : { failureStage: record.failureStage }),
      ...(record.failureCode === null ? {} : { failureCode: record.failureCode }),
      ...(record.failureMessage === null ? {} : { failureMessage: record.failureMessage }),
      ...(record.approvalId === null ? {} : { approvalId: record.approvalId }),
      ...(record.auditReference === null ? {} : { auditReference: record.auditReference }),
      ...(record.correlationId === null ? {} : { correlationId: record.correlationId }),
      forced: record.forced,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      ...(record.completedAt === null ? {} : { completedAt: record.completedAt.toISOString() }),
    };
  }

  private toAsset(record: StoredProductMediaAsset): ProductMediaAsset {
    return {
      id: record.id,
      tenantId: record.tenantId,
      storeId: record.storeId,
      mediaJobId: record.mediaJobId,
      assetType: record.assetType as ProductMediaAsset["assetType"],
      purpose: record.purpose,
      status: record.status as ProductMediaAsset["status"],
      aspectRatio: record.aspectRatio,
      width: record.width,
      height: record.height,
      format: record.format as ProductMediaAsset["format"],
      promptSnapshot: this.clone(record.promptSnapshot) as ProductMediaAsset["promptSnapshot"],
      ...(record.negativePrompt === null ? {} : { negativePrompt: record.negativePrompt }),
      sourceAssetReferences: this.clone(record.sourceAssetReferences) as readonly string[],
      ...(record.providerId === null ? {} : { providerId: record.providerId }),
      ...(record.providerReference === null ? {} : { providerReference: record.providerReference }),
      ...(record.storageKey === null ? {} : { storageKey: record.storageKey }),
      ...(record.outputUrl === null ? {} : { outputUrl: record.outputUrl }),
      altText: record.altText,
      ...(record.reviewNotes === null ? {} : { reviewNotes: record.reviewNotes }),
      ...(record.failureCode === null ? {} : { failureCode: record.failureCode }),
      ...(record.failureMessage === null ? {} : { failureMessage: record.failureMessage }),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private emptyJob(): ProductMediaJob {
    const now = new Date(0).toISOString();
    return {
      id: "",
      tenantId: "",
      storeId: "",
      productDraftId: "",
      idempotencyKey: "",
      mode: "PLAN_ONLY",
      status: "DRAFT",
      brandProfileSnapshot: {
        brandName: "",
        visualIdentity: [],
        preferredColorPalette: [],
        mood: [],
        lightingDirection: "",
        backgroundPreferences: [],
        prohibitedStyles: [],
        targetAudience: [],
        locale: "en-US",
        channelPreferences: [],
      },
      planSnapshot: {} as ProductMediaJob["planSnapshot"],
      qualityReportSnapshot: { score: 0, errors: [], warnings: [], requiresHumanReview: true, visualQuality: "UNKNOWN" },
      warnings: [],
      forced: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export const prismaProductMediaRepository = new PrismaProductMediaRepository(
  productMediaPrisma.productMediaJob,
  productMediaPrisma.productMediaAsset,
);
