import { AppError } from "../../../../shared/errors/app-error.js";
import type { ProductDraftRepository } from "../../../product-draft/domain/repositories/product-draft.repository.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type {
  ProductMediaAsset,
  ProductMediaAssetType,
  ProductMediaBrandProfile,
  ProductMediaJob,
  ProductMediaJobMode,
  ProductMediaJobWithAssets,
  ProductMediaPlan,
  ProductMediaSource,
} from "../../domain/models/index.js";
import type { ProductMediaRepository } from "../../domain/repositories/index.js";
import type { ProductMediaGenerationProvider } from "./product-media-generation-provider.js";
import { ProductMediaPlannerService } from "./product-media-planner.service.js";
import { ProductMediaSafetyValidator } from "./product-media-safety-validator.service.js";

type MaybePromise<T> = T | Promise<T>;

export interface ProductMediaApprovalRepository {
  readonly save: (context: TenantContext, approval: ApprovalRecord, expectedVersion?: number) => MaybePromise<ApprovalRecord>;
}

export interface ProductMediaAuditRepository {
  readonly append: (context: TenantContext, record: AuditRecord) => MaybePromise<AuditRecord>;
}

export interface ProductMediaOrchestratorDependencies {
  readonly productDraftRepositoryFactory: (tenant: TenantContext) => ProductDraftRepository;
  readonly productMediaRepository: ProductMediaRepository;
  readonly approvalRepository: ProductMediaApprovalRepository;
  readonly auditRepository: ProductMediaAuditRepository;
  readonly provider?: ProductMediaGenerationProvider;
  readonly planner?: ProductMediaPlannerService;
  readonly safetyValidator?: ProductMediaSafetyValidator;
  readonly idGenerator?: () => string;
  readonly now?: () => Date;
}

export interface ProductMediaStartRequest {
  readonly productDraftId: string;
  readonly mode: ProductMediaJobMode;
  readonly requestedAssetTypes?: readonly ProductMediaAssetType[];
  readonly channels?: readonly string[];
  readonly locale?: string;
  readonly brandProfile?: Partial<ProductMediaBrandProfile>;
  readonly sourceMedia?: readonly ProductMediaSource[];
  readonly providerId?: string;
  readonly requestedBy: string;
  readonly correlationId?: string;
  readonly force?: boolean;
}

export class ProductMediaOrchestratorService {
  private readonly planner: ProductMediaPlannerService;
  private readonly safetyValidator: ProductMediaSafetyValidator;
  private readonly idGenerator: () => string;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: ProductMediaOrchestratorDependencies) {
    this.planner = dependencies.planner ?? new ProductMediaPlannerService();
    this.safetyValidator = dependencies.safetyValidator ?? new ProductMediaSafetyValidator();
    this.idGenerator = dependencies.idGenerator ?? (() => crypto.randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(request: ProductMediaStartRequest, tenant: TenantContext): Promise<ProductMediaJobWithAssets> {
    const draft = await this.dependencies.productDraftRepositoryFactory(tenant).findById(request.productDraftId);
    if (draft === null) {
      throw AppError.notFound("Product draft was not found.", { productDraftId: request.productDraftId }, "PRODUCT_MEDIA_DRAFT_NOT_FOUND");
    }

    if (draft.status !== "draft" && draft.status !== "review_pending" && draft.status !== "approved") {
      throw AppError.badRequest("Product draft is not eligible for media planning.", { status: draft.status }, "PRODUCT_MEDIA_DRAFT_NOT_ELIGIBLE");
    }

    const idempotencyKey = this.buildIdempotencyKey(request);
    const existing = await this.dependencies.productMediaRepository.findEligibleByIdempotencyKey({
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      idempotencyKey,
    });
    if (existing !== undefined && request.force !== true) {
      await this.appendAudit(tenant, existing.job, "Product media job idempotent replay.", request.correlationId, true);
      return existing;
    }

    const parentJobId = existing?.job.id;
    const requestedAt = this.now().toISOString();
    const jobId = `product-media-job:${this.idGenerator()}`;
    const plan = this.planner.createPlan({
      productDraft: draft,
      ...(request.requestedAssetTypes === undefined ? {} : { requestedAssetTypes: request.requestedAssetTypes }),
      ...(request.channels === undefined ? {} : { channels: request.channels }),
      ...(request.locale === undefined ? {} : { locale: request.locale }),
      ...(request.brandProfile === undefined ? {} : { brandProfile: request.brandProfile }),
      ...(request.sourceMedia === undefined ? {} : { sourceMedia: request.sourceMedia }),
      createdAt: requestedAt,
      idGenerator: this.idGenerator,
    });
    const safety = this.safetyValidator.validate(plan);

    if (safety.errors.length > 0 || safety.blockedReasons.length > 0) {
      const failed = this.toJob({
        tenant,
        request,
        jobId,
        plan,
        idempotencyKey,
        requestedAt,
        ...(parentJobId === undefined ? {} : { parentJobId }),
        status: "FAILED",
        failureStage: "VALIDATING",
        failureCode: "PRODUCT_MEDIA_VALIDATION_BLOCKED",
        failureMessage: [...safety.errors, ...safety.blockedReasons].join(" "),
      });
      const assets = this.toAssets(tenant, jobId, plan, "FAILED", requestedAt);
      const persisted = await this.dependencies.productMediaRepository.createJob(failed, assets);
      await this.appendAudit(tenant, persisted.job, "Product media validation blocked.", request.correlationId);
      return persisted;
    }

    if (request.mode === "PLAN_ONLY") {
      const approvalId = await this.createApproval(tenant, jobId, request.productDraftId, request.requestedBy, requestedAt);
      const auditReference = this.auditId(jobId);
      const job = this.toJob({
        tenant,
        request,
        jobId,
        plan,
        idempotencyKey,
        requestedAt,
        ...(parentJobId === undefined ? {} : { parentJobId }),
        status: "PENDING_REVIEW",
        approvalId,
        auditReference,
      });
      const persisted = await this.dependencies.productMediaRepository.createJob(
        job,
        this.toAssets(tenant, jobId, plan, "PLANNED", requestedAt),
      );
      await this.appendAudit(tenant, persisted.job, "Product media plan created and pending review.", request.correlationId);
      return persisted;
    }

    const provider = this.dependencies.provider;
    if (provider?.configured !== true || (request.providerId !== undefined && request.providerId !== provider.providerId)) {
      const failed = this.toJob({
        tenant,
        request,
        jobId,
        plan,
        idempotencyKey,
        requestedAt,
        ...(parentJobId === undefined ? {} : { parentJobId }),
        status: "FAILED",
        failureStage: "GENERATING",
        failureCode: "PRODUCT_MEDIA_PROVIDER_UNCONFIGURED",
        failureMessage: "Product media generation provider is not configured.",
      });
      const persisted = await this.dependencies.productMediaRepository.createJob(failed, this.toAssets(tenant, jobId, plan, "FAILED", requestedAt));
      await this.appendAudit(tenant, persisted.job, "Product media generation failed safely.", request.correlationId);
      return persisted;
    }

    const providerResult = await provider.generate({ jobId, assets: plan.assets });
    const generatedAssets = this.toAssets(tenant, jobId, plan, "PENDING_REVIEW", requestedAt).map((asset) => {
      const result = providerResult.assets.find((candidate) => candidate.plannedAssetId === asset.id);
      if (result?.status === "FAILED") {
        return {
          ...asset,
          status: "FAILED" as const,
          ...(result.failureCode === undefined ? {} : { failureCode: result.failureCode }),
          ...(result.failureMessage === undefined ? {} : { failureMessage: result.failureMessage }),
        };
      }

      return {
        ...asset,
        status: "GENERATED" as const,
        providerId: provider.providerId,
        ...(result?.providerReference === undefined ? {} : { providerReference: result.providerReference }),
        ...(result?.storageKey === undefined ? {} : { storageKey: result.storageKey }),
        ...(result?.outputUrl === undefined ? {} : { outputUrl: result.outputUrl }),
      };
    });
    const failedAssetCount = generatedAssets.filter((asset) => asset.status === "FAILED").length;
    const approvalId = await this.createApproval(tenant, jobId, request.productDraftId, request.requestedBy, requestedAt);
    const job = this.toJob({
      tenant,
      request,
      jobId,
      plan,
      idempotencyKey,
      requestedAt,
      ...(parentJobId === undefined ? {} : { parentJobId }),
      status: failedAssetCount > 0 ? "PARTIALLY_GENERATED" : "PENDING_REVIEW",
      providerId: provider.providerId,
      approvalId,
      auditReference: this.auditId(jobId),
      warnings: providerResult.warnings,
    });
    const persisted = await this.dependencies.productMediaRepository.createJob(job, generatedAssets);
    await this.appendAudit(tenant, persisted.job, failedAssetCount > 0 ? "Product media partially generated." : "Product media generated and pending review.", request.correlationId);
    return persisted;
  }

  private toJob(input: {
    readonly tenant: TenantContext;
    readonly request: ProductMediaStartRequest;
    readonly jobId: string;
    readonly plan: ProductMediaPlan;
    readonly idempotencyKey: string;
    readonly requestedAt: string;
    readonly parentJobId?: string;
    readonly status: ProductMediaJob["status"];
    readonly providerId?: string;
    readonly approvalId?: string;
    readonly auditReference?: string;
    readonly failureStage?: string;
    readonly failureCode?: string;
    readonly failureMessage?: string;
    readonly warnings?: readonly string[];
  }): ProductMediaJob {
    return {
      id: input.jobId,
      tenantId: input.tenant.tenantId,
      storeId: input.tenant.storeId,
      ...(input.tenant.shopDomain === undefined ? {} : { shopDomain: input.tenant.shopDomain }),
      productDraftId: input.request.productDraftId,
      ...(input.parentJobId === undefined ? {} : { parentJobId: input.parentJobId }),
      idempotencyKey: input.idempotencyKey,
      mode: input.request.mode,
      status: input.status,
      ...(input.providerId === undefined ? {} : { providerId: input.providerId }),
      brandProfileSnapshot: input.plan.brandProfile,
      planSnapshot: input.plan,
      qualityReportSnapshot: input.plan.qualityReport,
      warnings: [...input.plan.warnings, ...(input.warnings ?? [])],
      ...(input.failureStage === undefined ? {} : { failureStage: input.failureStage }),
      ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
      ...(input.failureMessage === undefined ? {} : { failureMessage: input.failureMessage }),
      ...(input.approvalId === undefined ? {} : { approvalId: input.approvalId }),
      ...(input.auditReference === undefined ? {} : { auditReference: input.auditReference }),
      ...(input.request.correlationId === undefined ? {} : { correlationId: input.request.correlationId }),
      forced: input.request.force === true,
      createdAt: input.requestedAt,
      updatedAt: input.requestedAt,
      ...(input.status === "FAILED" ? { completedAt: input.requestedAt } : {}),
    };
  }

  private toAssets(
    tenant: TenantContext,
    jobId: string,
    plan: ProductMediaPlan,
    status: ProductMediaAsset["status"],
    createdAt: string,
  ): readonly ProductMediaAsset[] {
    return plan.assets.map((asset) => ({
      id: asset.id,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      mediaJobId: jobId,
      assetType: asset.assetType,
      purpose: asset.purpose,
      status,
      aspectRatio: asset.specification.aspectRatio,
      width: asset.specification.width,
      height: asset.specification.height,
      format: asset.specification.format,
      promptSnapshot: asset.prompt,
      negativePrompt: asset.prompt.negativePrompt,
      sourceAssetReferences: asset.specification.sourceAssetIds,
      altText: asset.altText,
      createdAt,
      updatedAt: createdAt,
    }));
  }

  private async createApproval(
    tenant: TenantContext,
    jobId: string,
    productDraftId: string,
    requestedBy: string,
    requestedAt: string,
  ): Promise<string> {
    const approvalId = `approval:${jobId}`;
    await this.dependencies.approvalRepository.save(tenant, {
      ...tenant,
      id: approvalId,
      proposalId: jobId,
      title: `Review product media for draft ${productDraftId}`,
      status: "pending",
      riskLevel: "LOW",
      requestedBy,
      createdAt: requestedAt,
      requestedAt,
      requiresHumanApproval: true,
      executionEnabled: false,
      source: "deterministic-preview",
      version: 1,
    });
    return approvalId;
  }

  private async appendAudit(
    tenant: TenantContext,
    job: ProductMediaJob,
    summary: string,
    correlationId: string | undefined,
    forceUnique = false,
  ): Promise<void> {
    const audit: AuditRecord = {
      ...tenant,
      id: forceUnique ? `${this.auditId(job.id)}:${this.idGenerator()}` : job.auditReference ?? this.auditId(job.id),
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId: job.id,
      actor: "product-media-engine",
      occurredAt: this.now().toISOString(),
      summary,
      details: {
        mediaJobId: job.id,
        productDraftId: job.productDraftId,
        status: job.status,
        mode: job.mode,
        providerId: job.providerId ?? null,
        failureCode: job.failureCode ?? null,
      },
      source: "deterministic-preview",
      sequence: Math.abs([...job.id].reduce((sum, character) => sum + character.charCodeAt(0), 0)),
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "product-media.engine",
      status: job.status === "FAILED" ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.now().toISOString(),
    };
    await this.dependencies.auditRepository.append(tenant, audit);
  }

  private buildIdempotencyKey(request: ProductMediaStartRequest): string {
    const normalized = JSON.stringify({
      productDraftId: request.productDraftId,
      mode: request.mode,
      providerId: request.providerId ?? null,
      requestedAssetTypes: [...(request.requestedAssetTypes ?? [])].sort(),
      channels: [...(request.channels ?? [])].sort(),
      locale: request.locale ?? null,
      sourceMedia: (request.sourceMedia ?? []).map((source) => source.sourceAssetId).sort(),
    });
    return `product-media:${this.hash(normalized)}`;
  }

  private hash(value: string): string {
    let hash = 0;
    for (const character of value) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  private auditId(jobId: string): string {
    return `audit:${jobId}`;
  }
}
