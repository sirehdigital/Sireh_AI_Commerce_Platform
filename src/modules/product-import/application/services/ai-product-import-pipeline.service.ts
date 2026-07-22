import { AppError } from "../../../../shared/errors/app-error.js";
import { ProductAnalyzerService } from "../../../ai-product/services/product-analyzer.service.js";
import { ProductBrandingService } from "../../../ai-product/services/product-branding.service.js";
import { ProductCopyService } from "../../../ai-product/services/product-copy.service.js";
import { ProductNormalizerService } from "../../../ai-product/services/product-normalizer.service.js";
import { ProductPricingService } from "../../../ai-product/services/product-pricing.service.js";
import { ProductRiskAssessmentService } from "../../../ai-product/services/product-risk-assessment.service.js";
import { ProductScoringService } from "../../../ai-product/services/product-scoring.service.js";
import { ShopifyProductMapperService } from "../../../ai-product/services/shopify-product-mapper.service.js";
import type {
  AIProductRecord,
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductRiskAssessment,
  ProductScoreBreakdown,
  RawProductInput,
  ShopifyProductPayload,
} from "../../../ai-product/types/product.types.js";
import type { ProductBrandingResult } from "../../../ai-product/services/product-branding.service.js";
import type { ProductPricingRecommendation } from "../../../ai-product/services/product-pricing.service.js";
import {
  CreateProductDraftApplicationError,
  type CreateProductDraftResult,
  type CreateProductDraftService,
} from "../../../product-draft/application/services/create-product-draft.service.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { ApprovalRecord, AuditRecord, TenantContext } from "../../../saie/application/index.js";
import { createTenantContext, DEFAULT_TENANT_CONTEXT } from "../../../saie/application/index.js";
import {
  AutoDsSupplierAdapter,
  GenericSupplierAdapter,
  WinningHunterManualResearchAdapter,
  type SupplierProductAdapter,
} from "../adapters/index.js";
import type {
  ProductImportExecutionInput,
  ProductImportFailureReason,
  ProductImportPersistenceStatus,
  ProductImportPipelineResult,
  ProductImportPipelineStatus,
  ProductImportSourcePlatform,
  ProductImportRecord,
  SupplierProductImportInput,
} from "../../domain/models/product-import.model.js";
import type { ProductImportRepository } from "../../domain/repositories/product-import.repository.js";
import { ProductImportDraftMapper } from "./product-import-draft.mapper.js";
import { ProductImportInputValidator } from "./product-import-input-validator.service.js";

const IMPORT_RECORD_VERSION = 1;
const BLOCKED_RISK_LEVELS = new Set<ProductRiskAssessment["level"]>(["high", "critical"]);

const optionalField = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> => (value === undefined ? {} : ({ [key]: value } as Record<Key, Value>));

export interface AIProductImportPipelineServiceDependencies {
  readonly draftService: CreateProductDraftService;
  readonly draftServiceFactory?: (tenant: TenantContext) => CreateProductDraftService;
  readonly productImportRepository: ProductImportRepository;
  readonly approvalRepository: ProductImportApprovalRepository;
  readonly auditRepository: ProductImportAuditRepository;
  readonly adapters?: readonly SupplierProductAdapter[];
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
  readonly normalizer?: ProductNormalizerService;
  readonly scoring?: ProductScoringService;
  readonly riskAssessment?: ProductRiskAssessmentService;
  readonly analyzer?: ProductAnalyzerService;
  readonly branding?: ProductBrandingService;
  readonly copy?: ProductCopyService;
  readonly pricing?: ProductPricingService;
  readonly shopifyMapper?: ShopifyProductMapperService;
  readonly draftMapper?: ProductImportDraftMapper;
  readonly validator?: ProductImportInputValidator;
}

type MaybePromise<T> = T | Promise<T>;

export interface ProductImportApprovalRepository {
  readonly save: (context: TenantContext, approval: ApprovalRecord, expectedVersion?: number) => MaybePromise<ApprovalRecord>;
}

export interface ProductImportAuditRepository {
  readonly append: (context: TenantContext, record: AuditRecord) => MaybePromise<AuditRecord>;
}

interface StageState {
  status: ProductImportPipelineStatus;
  supplierInput?: SupplierProductImportInput;
  rawProductInput?: RawProductInput;
  normalizedProduct?: NormalizedProduct;
  score?: ProductScoreBreakdown;
  riskResult?: ProductRiskAssessment;
  analysisResult?: ProductAIAnalysis;
  brandingResult?: ProductBrandingResult;
  copyResult?: ProductCopy;
  pricingResult?: ProductPricingRecommendation;
  shopifyPayload?: ShopifyProductPayload;
  aiRecord?: AIProductRecord;
  draftResult?: CreateProductDraftResult;
}

export class AIProductImportPipelineService {
  private readonly adapterRegistry: ReadonlyMap<ProductImportSourcePlatform, SupplierProductAdapter>;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly validator: ProductImportInputValidator;
  private readonly normalizer: ProductNormalizerService;
  private readonly scoring: ProductScoringService;
  private readonly riskAssessment: ProductRiskAssessmentService;
  private readonly analyzer: ProductAnalyzerService;
  private readonly branding: ProductBrandingService;
  private readonly copy: ProductCopyService;
  private readonly pricing: ProductPricingService;
  private readonly shopifyMapper: ShopifyProductMapperService;
  private readonly draftMapper: ProductImportDraftMapper;

  public constructor(private readonly dependencies: AIProductImportPipelineServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? (() => crypto.randomUUID());
    this.validator = dependencies.validator ?? new ProductImportInputValidator();
    this.normalizer = dependencies.normalizer ?? new ProductNormalizerService();
    this.scoring = dependencies.scoring ?? new ProductScoringService();
    this.riskAssessment = dependencies.riskAssessment ?? new ProductRiskAssessmentService();
    this.analyzer = dependencies.analyzer ?? new ProductAnalyzerService();
    this.branding = dependencies.branding ?? new ProductBrandingService();
    this.copy = dependencies.copy ?? new ProductCopyService();
    this.pricing = dependencies.pricing ?? new ProductPricingService();
    this.shopifyMapper = dependencies.shopifyMapper ?? new ShopifyProductMapperService();
    this.draftMapper = dependencies.draftMapper ?? new ProductImportDraftMapper();
    this.adapterRegistry = this.buildAdapterRegistry(dependencies.adapters);
  }

  public async execute(input: ProductImportExecutionInput): Promise<ProductImportPipelineResult> {
    const importId = this.buildImportId();
    const requestedAt = this.now().toISOString();
    const tenant = this.resolveTenant(input);
    const state: StageState = { status: "RECEIVED" };

    try {
      const adapter = this.resolveAdapter(input.sourcePlatform);
      const supplierInput = adapter.adapt(input.payload);
      state.supplierInput = supplierInput;
      const idempotencyKey = this.buildIdempotencyKey(supplierInput);
      const existingResult = this.dependencies.productImportRepository.findByIdentity({
        sourcePlatform: supplierInput.sourcePlatform,
        externalProductId: supplierInput.externalProductId,
        tenantId: tenant.tenantId,
        storeId: tenant.storeId,
      });
      const existingRecord = await this.dependencies.productImportRepository.findRecordByIdentity({
        sourcePlatform: supplierInput.sourcePlatform,
        externalProductId: supplierInput.externalProductId,
        tenantId: tenant.tenantId,
        storeId: tenant.storeId,
      });

      if ((await existingResult) !== undefined && input.force !== true) {
        const priorResult = await existingResult;
        if (priorResult === undefined) {
          throw AppError.internal("Product import duplicate lookup changed unexpectedly.");
        }
        const replayResult = this.toReplayResult(priorResult, importId, requestedAt);
        await this.appendAudit(tenant, replayResult, "Replayed existing product import result.", input.correlationId);
        return replayResult;
      }

      state.rawProductInput = this.validator.validate(supplierInput);
      state.normalizedProduct = this.normalizer.normalize(state.rawProductInput);
      state.status = "NORMALIZED";
      state.score = this.scoring.score(state.normalizedProduct);
      state.riskResult = this.riskAssessment.assess(state.normalizedProduct);

      if (BLOCKED_RISK_LEVELS.has(state.riskResult.level)) {
        throw AppError.forbidden(
          "Product import blocked by risk assessment.",
          { riskLevel: state.riskResult.level, reasons: state.riskResult.reasons },
          "PRODUCT_IMPORT_RISK_BLOCKED",
        );
      }

      state.analysisResult = this.analyzer.analyze(state.normalizedProduct, state.score, state.riskResult);
      state.brandingResult = this.branding.buildBranding(state.normalizedProduct, state.analysisResult);
      state.copyResult = this.copy.generate(state.normalizedProduct, state.analysisResult, state.brandingResult);
      state.pricingResult = this.pricing.recommend(state.normalizedProduct, state.analysisResult, state.brandingResult);
      state.shopifyPayload = this.shopifyMapper.map(
        state.normalizedProduct,
        state.analysisResult,
        state.brandingResult,
        state.copyResult,
        state.pricingResult,
      );
      state.aiRecord = {
        normalizedProduct: state.normalizedProduct,
        aiAnalysis: state.analysisResult,
        generatedCopy: state.copyResult,
        version: IMPORT_RECORD_VERSION,
        createdAt: state.normalizedProduct.createdAt,
        updatedAt: state.normalizedProduct.updatedAt,
      };
      state.status = "ANALYZED";

      const draftService = this.dependencies.draftServiceFactory?.(tenant) ?? this.dependencies.draftService;
      state.draftResult = await draftService.execute(
        this.draftMapper.map({
          importId,
          idempotencyKey,
          requestedBy: input.requestedBy,
          requestedAt,
          ...optionalField("correlationId", input.correlationId),
          supplierInput,
          engine: {
            record: state.aiRecord,
            normalizedProduct: state.normalizedProduct,
            score: state.score,
            risk: state.riskResult,
            analysis: state.analysisResult,
            branding: state.brandingResult,
            copy: state.copyResult,
            pricing: state.pricingResult,
            shopifyPayload: state.shopifyPayload,
          },
          forced: input.force === true,
        }),
      );
      state.status = "DRAFT_CREATED";

      const approvalId = await this.createApproval(tenant, importId, state.draftResult.draft, input.requestedBy, requestedAt);
      const successResult = this.toSuccessResult({
        importId,
        supplierInput,
        idempotencyKey,
        state,
        approvalId,
        forced: input.force === true,
      });
      const savedResult = await this.dependencies.productImportRepository.save(successResult);
      await this.appendAudit(tenant, savedResult, "Product import completed and is pending approval.", input.correlationId);
      await this.dependencies.productImportRepository.create(
        this.toPersistentRecord({
          tenant,
          requestedAt,
          result: savedResult,
          supplierInput,
          input,
          forced: input.force === true,
          ...(existingRecord?.importId === undefined ? {} : { parentImportId: existingRecord.importId }),
        }),
      );

      return savedResult;
    } catch (error: unknown) {
      const failureReason = this.toFailureReason(error, state.status);
      const failureResult = this.toFailureResult({
        importId,
        input,
        state,
        requestedAt,
        failureReason,
      });
      await this.dependencies.productImportRepository.create(
        this.toPersistentRecord({
          tenant,
          requestedAt,
          result: failureResult,
          ...(state.supplierInput === undefined ? {} : { supplierInput: state.supplierInput }),
          input,
          forced: input.force === true,
        }),
      );
      await this.appendAudit(tenant, failureResult, "Product import failed safely.", input.correlationId);
      return failureResult;
    }
  }

  private toSuccessResult(input: {
    readonly importId: string;
    readonly supplierInput: SupplierProductImportInput;
    readonly idempotencyKey: string;
    readonly state: StageState;
    readonly approvalId: string;
    readonly forced: boolean;
  }): ProductImportPipelineResult {
    return {
      importId: input.importId,
      source: this.toSource(input.supplierInput),
      idempotencyKey: input.idempotencyKey,
      idempotencyBehavior: input.forced ? "FORCED_REIMPORT" : "CREATED",
      ...optionalField("normalizedProduct", input.state.normalizedProduct),
      ...optionalField("riskResult", input.state.riskResult),
      ...optionalField("analysisResult", input.state.analysisResult),
      ...optionalField("brandingResult", input.state.brandingResult),
      ...optionalField("copyResult", input.state.copyResult),
      ...optionalField("pricingResult", input.state.pricingResult),
      ...optionalField("aiRecord", input.state.aiRecord),
      ...optionalField("shopifyDraft", input.state.draftResult?.draft),
      approvalStatus: "PENDING_APPROVAL",
      approvalId: input.approvalId,
      warnings: this.collectWarnings(input.state),
      auditReference: this.auditId(input.importId),
      finalPipelineStatus: "PENDING_APPROVAL",
      duplicate: false,
    };
  }

  private toReplayResult(
    existingResult: ProductImportPipelineResult,
    importId: string,
    requestedAt: string,
  ): ProductImportPipelineResult {
    const replayResult: ProductImportPipelineResult = {
      ...existingResult,
      importId,
      idempotencyBehavior: "REPLAYED_EXISTING",
      duplicate: true,
      auditReference: this.auditId(importId),
      warnings: [
        ...existingResult.warnings,
        `Duplicate import detected for ${existingResult.idempotencyKey}; returning prior draft result from ${requestedAt}.`,
      ],
    };
    return replayResult;
  }

  private toFailureResult(input: {
    readonly importId: string;
    readonly input: ProductImportExecutionInput;
    readonly state: StageState;
    readonly requestedAt: string;
    readonly failureReason: ProductImportFailureReason;
  }): ProductImportPipelineResult {
    const supplierInput = input.state.supplierInput;
    const source = supplierInput === undefined
      ? {
          platform: input.input.sourcePlatform,
          externalProductId: "unknown",
        }
      : this.toSource(supplierInput);

    return {
      importId: input.importId,
      source,
      idempotencyKey: supplierInput === undefined ? `${input.input.sourcePlatform}:unknown` : this.buildIdempotencyKey(supplierInput),
      idempotencyBehavior: input.input.force === true ? "FORCED_REIMPORT" : "CREATED",
      ...optionalField("normalizedProduct", input.state.normalizedProduct),
      ...optionalField("riskResult", input.state.riskResult),
      ...optionalField("analysisResult", input.state.analysisResult),
      ...optionalField("brandingResult", input.state.brandingResult),
      ...optionalField("copyResult", input.state.copyResult),
      ...optionalField("pricingResult", input.state.pricingResult),
      ...optionalField("aiRecord", input.state.aiRecord),
      ...optionalField("shopifyDraft", input.state.draftResult?.draft),
      approvalStatus: "NOT_CREATED",
      warnings: this.collectWarnings(input.state),
      auditReference: this.auditId(input.importId),
      finalPipelineStatus: "FAILED",
      duplicate: false,
      failureReason: input.failureReason,
    };
  }

  private toPersistentRecord(input: {
    readonly tenant: TenantContext;
    readonly requestedAt: string;
    readonly result: ProductImportPipelineResult;
    readonly supplierInput?: SupplierProductImportInput;
    readonly input: ProductImportExecutionInput;
    readonly forced: boolean;
    readonly parentImportId?: string;
  }): ProductImportRecord {
    const completedAt = input.result.finalPipelineStatus === "FAILED" ? undefined : this.now().toISOString();
    const payload = this.toSafePayload(input.input.payload, input.supplierInput);

    return {
      importId: input.result.importId,
      tenantId: input.tenant.tenantId,
      storeId: input.tenant.storeId,
      ...(input.tenant.shopDomain === undefined ? {} : { shopDomain: input.tenant.shopDomain }),
      sourcePlatform: input.result.source.platform,
      externalProductId: input.result.source.externalProductId,
      ...(input.supplierInput?.supplierUrl === undefined ? {} : { sourceUrl: input.supplierInput.supplierUrl }),
      ...(input.result.source.supplierName === undefined ? {} : { supplierName: input.result.source.supplierName }),
      status: this.toPersistenceStatus(input.result.finalPipelineStatus),
      pipelineStatus: input.result.finalPipelineStatus,
      idempotencyKey: input.result.idempotencyKey,
      idempotencyBehavior: input.result.idempotencyBehavior,
      duplicate: input.result.duplicate,
      forced: input.forced,
      ...(input.parentImportId === undefined ? {} : { parentImportId: input.parentImportId }),
      ...(input.result.shopifyDraft?.id === undefined ? {} : { productDraftId: input.result.shopifyDraft.id }),
      ...(input.result.approvalId === undefined ? {} : { approvalId: input.result.approvalId }),
      auditReference: input.result.auditReference,
      ...(input.result.failureReason?.stage === undefined ? {} : { failureStage: input.result.failureReason.stage }),
      ...(input.result.failureReason?.code === undefined ? {} : { failureCode: input.result.failureReason.code }),
      ...(input.result.failureReason?.message === undefined ? {} : { failureMessage: input.result.failureReason.message }),
      warnings: input.result.warnings,
      payload,
      resultSnapshot: input.result,
      createdAt: input.requestedAt,
      updatedAt: this.now().toISOString(),
      ...(completedAt === undefined ? {} : { completedAt }),
    };
  }

  private toPersistenceStatus(status: ProductImportPipelineStatus): ProductImportPersistenceStatus {
    if (status === "DRAFT_CREATED") {
      return "DRAFT_CREATED";
    }

    if (status === "PENDING_APPROVAL") {
      return "PENDING_APPROVAL";
    }

    if (status === "FAILED") {
      return "FAILED";
    }

    if (status === "NORMALIZED" || status === "ANALYZED") {
      return "PROCESSING";
    }

    return "RECEIVED";
  }

  private toSafePayload(payload: unknown, supplierInput: SupplierProductImportInput | undefined): Readonly<Record<string, unknown>> {
    if (supplierInput !== undefined) {
      return {
        externalProductId: supplierInput.externalProductId,
        sourcePlatform: supplierInput.sourcePlatform,
        supplierName: supplierInput.supplierName,
        supplierUrl: supplierInput.supplierUrl,
        title: supplierInput.title,
        description: supplierInput.description,
        brand: supplierInput.brand,
        category: supplierInput.category,
        productType: supplierInput.productType,
        images: supplierInput.images.map((image) => ({ ...image })),
        variants: supplierInput.variants.map((variant) => ({ ...variant })),
        supplierPrice: supplierInput.supplierPrice,
        compareAtPrice: supplierInput.compareAtPrice,
        currency: supplierInput.currency,
        inventory: supplierInput.inventory,
        shippingOrigin: supplierInput.shippingOrigin,
        shippingDestinations: [...supplierInput.shippingDestinations],
        estimatedDelivery: supplierInput.estimatedDelivery,
        tags: [...supplierInput.tags],
        rawMetadata: this.redactSensitiveValues(supplierInput.rawMetadata),
      };
    }

    return this.redactSensitiveValues(this.isRecord(payload) ? payload : { payloadType: typeof payload });
  }

  private redactSensitiveValues(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (/token|secret|password|credential|authorization|api[-_]?key/iu.test(key)) {
          return [key, "[REDACTED]"];
        }

        if (this.isRecord(entry)) {
          return [key, this.redactSensitiveValues(entry)];
        }

        return [key, entry];
      }),
    );
  }

  private isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private async createApproval(
    tenant: TenantContext,
    importId: string,
    draft: ProductDraft,
    requestedBy: string,
    requestedAt: string,
  ): Promise<string> {
    const approvalId = `approval:${importId}`;

    await this.dependencies.approvalRepository.save(tenant, {
      ...tenant,
      id: approvalId,
      proposalId: draft.id,
      title: `Approve imported product draft: ${draft.title}`,
      status: "pending",
      riskLevel: this.toApprovalRiskLevel(draft.riskAssessment?.level ?? "unknown"),
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
    result: ProductImportPipelineResult,
    summary: string,
    correlationId: string | undefined,
  ): Promise<void> {
    await this.dependencies.auditRepository.append(tenant, {
      ...tenant,
      id: result.auditReference,
      eventType: "preview.agent-activity",
      entityType: "agent-activity",
      entityId: result.importId,
      actor: "product-import-pipeline",
      occurredAt: this.now().toISOString(),
      summary,
      details: {
        importId: result.importId,
        sourcePlatform: result.source.platform,
        externalProductId: result.source.externalProductId,
        finalPipelineStatus: result.finalPipelineStatus,
        approvalStatus: result.approvalStatus,
        duplicate: result.duplicate,
        failureCode: result.failureReason?.code ?? null,
      },
      source: "deterministic-preview",
      sequence: this.sequenceFromImportId(result.importId),
      ...(correlationId === undefined ? {} : { correlationId }),
      activityType: "product-import.pipeline",
      status: result.finalPipelineStatus === "FAILED" ? "BLOCKED" : "READY_FOR_REVIEW",
      recordedAt: this.now().toISOString(),
    });
  }

  private collectWarnings(state: StageState): readonly string[] {
    return [
      ...(state.pricingResult?.warnings ?? []),
      ...(state.riskResult?.level === "medium" ? ["Product import has medium risk and requires careful human review."] : []),
    ];
  }

  private toFailureReason(error: unknown, stage: ProductImportPipelineStatus): ProductImportFailureReason {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        stage,
        ...(error.details === undefined ? {} : { details: error.details }),
      };
    }

    if (error instanceof CreateProductDraftApplicationError) {
      return {
        code: error.code,
        message: error.message,
        stage,
        details: { validationIssues: error.validationIssues, ...error.metadata },
      };
    }

    return {
      code: "PRODUCT_IMPORT_PIPELINE_FAILED",
      message: "Product import pipeline failed for an unknown reason.",
      stage,
    };
  }

  private buildAdapterRegistry(adapters: readonly SupplierProductAdapter[] | undefined): ReadonlyMap<ProductImportSourcePlatform, SupplierProductAdapter> {
    const registry = new Map<ProductImportSourcePlatform, SupplierProductAdapter>();

    for (const adapter of adapters ?? [new GenericSupplierAdapter(), new AutoDsSupplierAdapter(), new WinningHunterManualResearchAdapter()]) {
      registry.set(adapter.sourcePlatform, adapter);
    }

    return registry;
  }

  private resolveAdapter(sourcePlatform: ProductImportSourcePlatform): SupplierProductAdapter {
    const adapter = this.adapterRegistry.get(sourcePlatform);

    if (adapter === undefined) {
      throw AppError.badRequest(
        "Product import source platform is not supported.",
        { sourcePlatform },
        "PRODUCT_IMPORT_UNSUPPORTED_SOURCE_PLATFORM",
      );
    }

    return adapter;
  }

  private resolveTenant(input: ProductImportExecutionInput): TenantContext {
    if (input.tenantId === undefined && input.storeId === undefined && input.shopDomain === undefined) {
      return DEFAULT_TENANT_CONTEXT;
    }

    return createTenantContext({
      tenantId: input.tenantId ?? DEFAULT_TENANT_CONTEXT.tenantId,
      storeId: input.storeId ?? DEFAULT_TENANT_CONTEXT.storeId,
      shopDomain: input.shopDomain,
    });
  }

  private buildIdempotencyKey(input: SupplierProductImportInput): string {
    return `${input.sourcePlatform}:${input.externalProductId}`.trim().toLowerCase();
  }

  private buildImportId(): string {
    return `product-import:${this.idGenerator()}`;
  }

  private auditId(importId: string): string {
    return `audit:${importId}`;
  }

  private sequenceFromImportId(importId: string): number {
    return Math.abs([...importId].reduce((sum, character) => sum + character.charCodeAt(0), 0));
  }

  private toSource(input: SupplierProductImportInput): ProductImportPipelineResult["source"] {
    return {
      platform: input.sourcePlatform,
      externalProductId: input.externalProductId,
      ...optionalField("supplierName", input.supplierName),
    };
  }

  private toApprovalRiskLevel(level: ProductDraft["riskAssessment"] extends infer Risk ? Risk extends { level?: infer Level } ? Level : never : never): "LOW" | "MEDIUM" | "HIGH" {
    if (level === "high" || level === "critical") {
      return "HIGH";
    }

    if (level === "medium") {
      return "MEDIUM";
    }

    return "LOW";
  }
}
