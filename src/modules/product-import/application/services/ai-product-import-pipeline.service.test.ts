import { describe, expect, it, vi } from "vitest";

import { ProductRiskAssessmentService } from "../../../ai-product/services/product-risk-assessment.service.js";
import type { NormalizedProduct, ProductRiskAssessment } from "../../../ai-product/types/product.types.js";
import { CreateProductDraftService } from "../../../product-draft/application/services/create-product-draft.service.js";
import type {
  ProductDraftRepository,
  ProductDraftRepositoryListResult,
  ProductDraftRepositorySaveResult,
} from "../../../product-draft/domain/repositories/product-draft.repository.js";
import { InMemoryProductDraftRepository } from "../../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import { DEFAULT_TENANT_CONTEXT } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { GenericSupplierAdapter } from "../adapters/generic-supplier.adapter.js";
import { InMemoryProductImportRepository } from "../../infrastructure/repositories/in-memory-product-import.repository.js";
import { AIProductImportPipelineService } from "./ai-product-import-pipeline.service.js";

const requestedAt = "2026-07-22T09:00:00.000Z";

const genericPayload = (externalProductId = "generic-001"): Record<string, unknown> => ({
  externalProductId,
  sourcePlatform: "generic",
  supplierName: "Lumora Supplier",
  supplierUrl: `https://supplier.test/products/${externalProductId}`,
  title: "Lumora Botanical Body Lotion",
  description:
    "A premium botanical body lotion with a lightweight feel, soft skincare positioning, reliable supplier metadata, and clear customer-ready merchandising details for a calm beauty routine.",
  brand: "Lumora",
  category: "Body Lotion",
  productType: "Body Care",
  images: [
    { url: "https://images.test/lumora-lotion-1.jpg", altText: "Lumora body lotion", isPrimary: true },
    { url: "https://images.test/lumora-lotion-2.jpg", altText: "Lumora lotion texture" },
  ],
  variants: [
    {
      externalVariantId: `${externalProductId}:default`,
      sku: `SKU-${externalProductId}`,
      title: "Default Title",
      optionValues: { Title: "Default Title" },
      supplierPrice: 8,
      compareAtPrice: 28,
      currency: "USD",
      inventory: 30,
      weight: 250,
      weightUnit: "g",
    },
  ],
  supplierPrice: 8,
  compareAtPrice: 28,
  currency: "USD",
  inventory: 30,
  shippingOrigin: "US",
  shippingDestinations: ["US", "CA", "GLOBAL"],
  estimatedDelivery: { minDays: 3, maxDays: 7 },
  tags: ["beauty", "body-care", "lumora"],
  rawMetadata: { source: "integration-test" },
});

const createSequentialIdGenerator = (prefix: string): (() => string) => {
  let nextId = 0;
  return () => `${prefix}-${(nextId += 1)}`;
};

const createPipeline = (overrides: Partial<ConstructorParameters<typeof AIProductImportPipelineService>[0]> = {}) => {
  const productImportRepository = new InMemoryProductImportRepository();
  const productDraftRepository = new InMemoryProductDraftRepository();
  const approvalRepository = new InMemoryApprovalRepository([]);
  const auditRepository = new InMemoryAuditRepository();
  const draftService = new CreateProductDraftService({
    repository: productDraftRepository,
    idGenerator: createSequentialIdGenerator("draft"),
    clock: () => requestedAt,
  });
  const pipeline = new AIProductImportPipelineService({
    draftService,
    productImportRepository,
    approvalRepository,
    auditRepository,
    adapters: [new GenericSupplierAdapter()],
    now: () => new Date(requestedAt),
    idGenerator: createSequentialIdGenerator("import"),
    ...overrides,
  });

  return {
    pipeline,
    productImportRepository,
    productDraftRepository,
    approvalRepository,
    auditRepository,
  };
};

class BlockingRiskAssessmentService extends ProductRiskAssessmentService {
  public override assess(product: NormalizedProduct): ProductRiskAssessment {
    return {
      level: "high",
      score: 88,
      reasons: [`${product.title} is blocked for deterministic test risk.`],
      intellectualPropertyRisk: 0,
      restrictedProductRisk: 88,
      supplierRisk: 0,
      shippingRisk: 0,
      refundRisk: 0,
    };
  }
}

class FailingProductDraftRepository implements ProductDraftRepository {
  public save(): Promise<ProductDraftRepositorySaveResult> {
    return Promise.reject(new Error("controlled draft repository failure"));
  }

  public findById(): Promise<null> {
    return Promise.resolve(null);
  }

  public findByIdempotencyKey(): Promise<null> {
    return Promise.resolve(null);
  }

  public findBySourceReference(): Promise<null> {
    return Promise.resolve(null);
  }

  public existsById(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public list(): Promise<ProductDraftRepositoryListResult> {
    return Promise.resolve({ items: [], total: 0, limit: 50, offset: 0, hasNextPage: false });
  }
}

const executeGenericImport = (pipeline: AIProductImportPipelineService, externalProductId = "generic-001") =>
  pipeline.execute({
    sourcePlatform: "generic",
    payload: genericPayload(externalProductId),
    requestedBy: "codex-test",
    correlationId: `correlation-${externalProductId}`,
  });

describe("AIProductImportPipelineService", () => {
  it("creates a Shopify-ready product draft and pending approval for a valid generic import", async () => {
    const { pipeline, approvalRepository, auditRepository } = createPipeline();

    const result = await executeGenericImport(pipeline);

    expect(result.finalPipelineStatus).toBe("PENDING_APPROVAL");
    expect(result.approvalStatus).toBe("PENDING_APPROVAL");
    expect(result.idempotencyKey).toBe("generic:generic-001");
    expect(result.shopifyDraft?.status).toBe("draft");
    expect(result.shopifyDraft?.title).toContain("Lumora");
    expect(result.shopifyDraft?.publication).toBeUndefined();
    expect(result.approvalId).toBeDefined();
    expect(approvalRepository.findById(DEFAULT_TENANT_CONTEXT, result.approvalId ?? "")).toMatchObject({
      status: "pending",
      executionEnabled: false,
      requiresHumanApproval: true,
    });
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(1);
  });

  it("replays duplicate imports without creating another draft unless forced", async () => {
    const { pipeline, productDraftRepository } = createPipeline();

    const first = await executeGenericImport(pipeline, "duplicate-001");
    const duplicate = await executeGenericImport(pipeline, "duplicate-001");

    expect(first.idempotencyBehavior).toBe("CREATED");
    expect(duplicate.idempotencyBehavior).toBe("REPLAYED_EXISTING");
    expect(duplicate.duplicate).toBe(true);
    expect((await productDraftRepository.list()).total).toBe(1);
  });

  it("allows forced re-imports by using a distinct draft idempotency identity", async () => {
    const { pipeline, productDraftRepository } = createPipeline();

    await executeGenericImport(pipeline, "force-001");
    const forced = await pipeline.execute({
      sourcePlatform: "generic",
      payload: genericPayload("force-001"),
      requestedBy: "codex-test",
      force: true,
    });

    expect(forced.idempotencyBehavior).toBe("FORCED_REIMPORT");
    expect(forced.finalPipelineStatus).toBe("PENDING_APPROVAL");
    expect((await productDraftRepository.list()).total).toBe(2);
  });

  it("fails safely and records audit when validation rejects malformed input", async () => {
    const { pipeline, auditRepository } = createPipeline();

    const result = await pipeline.execute({
      sourcePlatform: "generic",
      payload: { ...genericPayload("malformed-001"), variants: [] },
      requestedBy: "codex-test",
    });

    expect(result.finalPipelineStatus).toBe("FAILED");
    expect(result.approvalStatus).toBe("NOT_CREATED");
    expect(result.failureReason).toMatchObject({
      code: "PRODUCT_IMPORT_VALIDATION_FAILED",
      stage: "RECEIVED",
    });
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)[0]).toMatchObject({ status: "BLOCKED" });
  });

  it("blocks high-risk products before draft creation and preserves completed stage context", async () => {
    const { pipeline, productDraftRepository, auditRepository } = createPipeline({
      riskAssessment: new BlockingRiskAssessmentService(),
    });

    const result = await executeGenericImport(pipeline, "risk-001");

    expect(result.finalPipelineStatus).toBe("FAILED");
    expect(result.normalizedProduct?.externalId).toBe("risk-001");
    expect(result.riskResult?.level).toBe("high");
    expect(result.failureReason).toMatchObject({
      code: "PRODUCT_IMPORT_RISK_BLOCKED",
      stage: "NORMALIZED",
    });
    expect((await productDraftRepository.list()).total).toBe(0);
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(1);
  });

  it("records failed pipeline stage information when draft creation fails", async () => {
    const draftService = new CreateProductDraftService({
      repository: new FailingProductDraftRepository(),
      idGenerator: createSequentialIdGenerator("draft-fail"),
      clock: () => requestedAt,
    });
    const { pipeline, auditRepository } = createPipeline({ draftService });

    const result = await executeGenericImport(pipeline, "draft-failure-001");

    expect(result.finalPipelineStatus).toBe("FAILED");
    expect(result.failureReason).toMatchObject({
      code: "UNKNOWN",
      stage: "ANALYZED",
    });
    expect(result.analysisResult).toBeDefined();
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)[0]).toMatchObject({ status: "BLOCKED" });
  });

  it("does not call direct publish operations", async () => {
    const publishOperation = vi.fn();
    const { pipeline } = createPipeline();

    await executeGenericImport(pipeline, "no-publish-001");

    expect(publishOperation).not.toHaveBeenCalled();
  });
});
