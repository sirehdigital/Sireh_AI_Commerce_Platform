import { AppError } from "../../../../shared/errors/app-error.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { ProductDraftRepository } from "../../../product-draft/domain/repositories/product-draft.repository.js";
import type {
  ProductImportExecutionInput,
  ProductImportListQuery,
  ProductImportPersistenceStatus,
  ProductImportPipelineResult,
  ProductImportRecord,
  ProductImportSourcePlatform,
} from "../../domain/models/product-import.model.js";
import type { ProductImportRepository } from "../../domain/repositories/product-import.repository.js";
import type { AIProductImportPipelineService } from "./ai-product-import-pipeline.service.js";

export interface ProductImportStartRequest {
  readonly sourcePlatform: ProductImportSourcePlatform;
  readonly payload: unknown;
  readonly requestedBy: string;
  readonly forceReimport: boolean;
  readonly correlationId?: string;
}

export interface ProductImportListRequest {
  readonly status?: ProductImportPersistenceStatus;
  readonly sourcePlatform?: ProductImportSourcePlatform;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ProductImportSummaryResponse {
  readonly importId: string;
  readonly status: ProductImportPersistenceStatus;
  readonly pipelineStatus: ProductImportRecord["pipelineStatus"];
  readonly sourcePlatform: ProductImportSourcePlatform;
  readonly externalProductId: string;
  readonly productDraftId?: string;
  readonly approvalId?: string;
  readonly duplicate: boolean;
  readonly forced: boolean;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface ProductImportDetailResponse extends ProductImportSummaryResponse {
  readonly supplierName?: string;
  readonly sourceUrl?: string;
  readonly idempotencyKey: string;
  readonly idempotencyBehavior: ProductImportRecord["idempotencyBehavior"];
  readonly auditReference?: string;
  readonly warnings: readonly string[];
  readonly failureStage?: ProductImportRecord["failureStage"];
  readonly parentImportId?: string;
  readonly linkedResources?: ProductImportLinkedResourcesResponse;
}

export interface ProductImportLinkedResourcesResponse {
  readonly productDraft?: ProductImportProductDraftSummaryResponse;
  readonly approval?: ProductImportApprovalSummaryResponse;
  readonly audit?: ProductImportAuditSummaryResponse;
}

export interface ProductImportProductDraftSummaryResponse {
  readonly id: string;
  readonly status: ProductDraft["status"];
  readonly title: string;
  readonly version: number;
}

export interface ProductImportApprovalSummaryResponse {
  readonly id: string;
  readonly status: ApprovalRecord["status"];
  readonly proposalId: string;
  readonly requiresHumanApproval: boolean;
  readonly executionEnabled: boolean;
}

export interface ProductImportAuditSummaryResponse {
  readonly id: string;
  readonly eventType: AuditRecord["eventType"];
  readonly entityId: string;
  readonly status?: AuditRecord["status"];
  readonly occurredAt: string;
}

export interface ProductImportStatusResponse {
  readonly importId: string;
  readonly status: ProductImportPersistenceStatus;
  readonly pipelineStatus: ProductImportRecord["pipelineStatus"];
  readonly productDraftId?: string;
  readonly approvalId?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface ProductImportListResponse {
  readonly items: readonly ProductImportSummaryResponse[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}

type MaybePromise<T> = T | Promise<T>;

export interface ProductImportApiLinkedRepositoryDependencies {
  readonly productDraftRepositoryFactory?: (tenant: TenantContext) => ProductDraftRepository;
  readonly approvalRepository?: {
    readonly findById: (tenant: TenantContext, approvalId: string) => MaybePromise<ApprovalRecord | undefined>;
  };
  readonly auditRepository?: {
    readonly findById: (tenant: TenantContext, auditId: string) => MaybePromise<AuditRecord | undefined>;
  };
}

export class ProductImportApiService {
  public constructor(
    private readonly pipeline: AIProductImportPipelineService,
    private readonly repository: ProductImportRepository,
    private readonly linkedRepositories: ProductImportApiLinkedRepositoryDependencies = {},
  ) {}

  public async startImport(
    request: ProductImportStartRequest,
    tenant: TenantContext,
  ): Promise<ProductImportDetailResponse> {
    const result = await this.pipeline.execute(this.toExecutionInput(request, tenant));
    this.throwForFailedMutation(result);
    const record = await this.repository.findById(result.importId);

    if (record === undefined) {
      return this.toDetailResponse(this.toFallbackRecord(result, request, tenant), tenant);
    }

    return this.toDetailResponse(record, tenant);
  }

  public async listImports(
    request: ProductImportListRequest,
    tenant: TenantContext,
  ): Promise<ProductImportListResponse> {
    const query: ProductImportListQuery = {
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      ...(request.status === undefined ? {} : { status: request.status }),
      ...(request.sourcePlatform === undefined ? {} : { sourcePlatform: request.sourcePlatform }),
      ...(request.limit === undefined ? {} : { limit: request.limit }),
      ...(request.offset === undefined ? {} : { offset: request.offset }),
    };
    const result = await this.repository.list(query);

    return {
      items: result.items.map((record) => this.toSummaryResponse(record)),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasNextPage: result.hasNextPage,
      ...(result.nextOffset === undefined ? {} : { nextOffset: result.nextOffset }),
    };
  }

  public async getImport(importId: string, tenant: TenantContext): Promise<ProductImportDetailResponse> {
    return this.toDetailResponse(await this.getTenantRecord(importId, tenant), tenant);
  }

  public async getImportStatus(importId: string, tenant: TenantContext): Promise<ProductImportStatusResponse> {
    return this.toStatusResponse(await this.getTenantRecord(importId, tenant));
  }

  public async retryImport(
    importId: string,
    requestedBy: string,
    tenant: TenantContext,
    correlationId: string | undefined,
  ): Promise<ProductImportDetailResponse> {
    const record = await this.getTenantRecord(importId, tenant);
    const result = await this.pipeline.execute({
      sourcePlatform: record.sourcePlatform,
      payload: record.payload,
      requestedBy,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      ...(correlationId === undefined ? {} : { correlationId }),
      force: true,
    });
    this.throwForFailedMutation(result);
    const retryRecord = await this.repository.findById(result.importId);

    if (retryRecord === undefined) {
      return this.toDetailResponse(this.toFallbackRecord(result, {
        sourcePlatform: record.sourcePlatform,
        payload: record.payload,
        requestedBy,
        forceReimport: true,
        ...(correlationId === undefined ? {} : { correlationId }),
      }, tenant), tenant);
    }

    return this.toDetailResponse(retryRecord, tenant);
  }

  private throwForFailedMutation(result: ProductImportPipelineResult): void {
    if (result.finalPipelineStatus !== "FAILED") {
      return;
    }

    const failure = result.failureReason;
    const statusCode = failure?.code === "PRODUCT_IMPORT_RISK_BLOCKED" ? 403 : 400;

    throw new AppError({
      message: failure?.message ?? "Product import failed.",
      statusCode,
      code: failure?.code ?? "PRODUCT_IMPORT_FAILED",
      details: {
        importId: result.importId,
        failureStage: failure?.stage ?? "FAILED",
        ...(failure?.details === undefined ? {} : { failureDetails: failure.details }),
      },
    });
  }

  private async getTenantRecord(importId: string, tenant: TenantContext): Promise<ProductImportRecord> {
    const record = await this.repository.findById(importId);

    if (record?.tenantId !== tenant.tenantId || record.storeId !== tenant.storeId) {
      throw AppError.notFound("Product import was not found.", { importId }, "PRODUCT_IMPORT_NOT_FOUND");
    }

    if (tenant.shopDomain !== undefined && record.shopDomain !== tenant.shopDomain) {
      throw AppError.notFound("Product import was not found.", { importId }, "PRODUCT_IMPORT_NOT_FOUND");
    }

    return record;
  }

  private toExecutionInput(request: ProductImportStartRequest, tenant: TenantContext): ProductImportExecutionInput {
    return {
      sourcePlatform: request.sourcePlatform,
      payload: request.payload,
      requestedBy: request.requestedBy,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
      force: request.forceReimport,
    };
  }

  private toSummaryResponse(record: ProductImportRecord): ProductImportSummaryResponse {
    return {
      importId: record.importId,
      status: record.status,
      pipelineStatus: record.pipelineStatus,
      sourcePlatform: record.sourcePlatform,
      externalProductId: record.externalProductId,
      ...(record.productDraftId === undefined ? {} : { productDraftId: record.productDraftId }),
      ...(record.approvalId === undefined ? {} : { approvalId: record.approvalId }),
      duplicate: record.duplicate,
      forced: record.forced,
      ...(record.failureCode === undefined ? {} : { failureCode: record.failureCode }),
      ...(record.failureMessage === undefined ? {} : { failureMessage: record.failureMessage }),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.completedAt === undefined ? {} : { completedAt: record.completedAt }),
    };
  }

  private async toDetailResponse(record: ProductImportRecord, tenant: TenantContext): Promise<ProductImportDetailResponse> {
    const linkedResources = await this.toLinkedResources(record, tenant);

    return {
      ...this.toSummaryResponse(record),
      ...(record.supplierName === undefined ? {} : { supplierName: record.supplierName }),
      ...(record.sourceUrl === undefined ? {} : { sourceUrl: record.sourceUrl }),
      idempotencyKey: record.idempotencyKey,
      idempotencyBehavior: record.idempotencyBehavior,
      ...(record.auditReference === undefined ? {} : { auditReference: record.auditReference }),
      warnings: record.warnings,
      ...(record.failureStage === undefined ? {} : { failureStage: record.failureStage }),
      ...(record.parentImportId === undefined ? {} : { parentImportId: record.parentImportId }),
      ...(linkedResources === undefined ? {} : { linkedResources }),
    };
  }

  private async toLinkedResources(
    record: ProductImportRecord,
    tenant: TenantContext,
  ): Promise<ProductImportLinkedResourcesResponse | undefined> {
    const [productDraft, approval, audit] = await Promise.all([
      this.findLinkedProductDraft(record, tenant),
      this.findLinkedApproval(record, tenant),
      this.findLinkedAudit(record, tenant),
    ]);
    const linkedResources: ProductImportLinkedResourcesResponse = {
      ...(productDraft === undefined ? {} : { productDraft }),
      ...(approval === undefined ? {} : { approval }),
      ...(audit === undefined ? {} : { audit }),
    };

    return Object.keys(linkedResources).length === 0 ? undefined : linkedResources;
  }

  private async findLinkedProductDraft(
    record: ProductImportRecord,
    tenant: TenantContext,
  ): Promise<ProductImportProductDraftSummaryResponse | undefined> {
    if (record.productDraftId === undefined || this.linkedRepositories.productDraftRepositoryFactory === undefined) {
      return undefined;
    }

    const draft = await this.linkedRepositories.productDraftRepositoryFactory(tenant).findById(record.productDraftId);
    if (draft === null) {
      return undefined;
    }

    return {
      id: draft.id,
      status: draft.status,
      title: draft.title,
      version: draft.version,
    };
  }

  private async findLinkedApproval(
    record: ProductImportRecord,
    tenant: TenantContext,
  ): Promise<ProductImportApprovalSummaryResponse | undefined> {
    if (record.approvalId === undefined || this.linkedRepositories.approvalRepository === undefined) {
      return undefined;
    }

    const approval = await this.linkedRepositories.approvalRepository.findById(tenant, record.approvalId);
    if (approval === undefined) {
      return undefined;
    }

    return {
      id: approval.id,
      status: approval.status,
      proposalId: approval.proposalId,
      requiresHumanApproval: approval.requiresHumanApproval,
      executionEnabled: approval.executionEnabled,
    };
  }

  private async findLinkedAudit(
    record: ProductImportRecord,
    tenant: TenantContext,
  ): Promise<ProductImportAuditSummaryResponse | undefined> {
    if (record.auditReference === undefined || this.linkedRepositories.auditRepository === undefined) {
      return undefined;
    }

    const audit = await this.linkedRepositories.auditRepository.findById(tenant, record.auditReference);
    if (audit === undefined) {
      return undefined;
    }

    return {
      id: audit.id,
      eventType: audit.eventType,
      entityId: audit.entityId,
      ...(audit.status === undefined ? {} : { status: audit.status }),
      occurredAt: audit.occurredAt,
    };
  }

  private toStatusResponse(record: ProductImportRecord): ProductImportStatusResponse {
    return {
      importId: record.importId,
      status: record.status,
      pipelineStatus: record.pipelineStatus,
      ...(record.productDraftId === undefined ? {} : { productDraftId: record.productDraftId }),
      ...(record.approvalId === undefined ? {} : { approvalId: record.approvalId }),
      ...(record.failureCode === undefined ? {} : { failureCode: record.failureCode }),
      ...(record.failureMessage === undefined ? {} : { failureMessage: record.failureMessage }),
      updatedAt: record.updatedAt,
      ...(record.completedAt === undefined ? {} : { completedAt: record.completedAt }),
    };
  }

  private toFallbackRecord(
    result: ProductImportPipelineResult,
    request: ProductImportStartRequest,
    tenant: TenantContext,
  ): ProductImportRecord {
    const now = new Date().toISOString();

    return {
      importId: result.importId,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      sourcePlatform: result.source.platform,
      externalProductId: result.source.externalProductId,
      status: result.finalPipelineStatus === "FAILED" ? "FAILED" : "PENDING_APPROVAL",
      pipelineStatus: result.finalPipelineStatus,
      idempotencyKey: result.idempotencyKey,
      idempotencyBehavior: result.idempotencyBehavior,
      duplicate: result.duplicate,
      forced: request.forceReimport,
      ...(result.shopifyDraft?.id === undefined ? {} : { productDraftId: result.shopifyDraft.id }),
      ...(result.approvalId === undefined ? {} : { approvalId: result.approvalId }),
      auditReference: result.auditReference,
      ...(result.failureReason?.stage === undefined ? {} : { failureStage: result.failureReason.stage }),
      ...(result.failureReason?.code === undefined ? {} : { failureCode: result.failureReason.code }),
      ...(result.failureReason?.message === undefined ? {} : { failureMessage: result.failureReason.message }),
      warnings: result.warnings,
      payload: typeof request.payload === "object" && request.payload !== null && !Array.isArray(request.payload)
        ? (request.payload as Readonly<Record<string, unknown>>)
        : {},
      resultSnapshot: result,
      createdAt: now,
      updatedAt: now,
      ...(result.finalPipelineStatus === "FAILED" ? {} : { completedAt: now }),
    };
  }
}
