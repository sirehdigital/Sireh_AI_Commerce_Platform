import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { CreateProductDraftService } from "../../product-draft/application/services/create-product-draft.service.js";
import { InMemoryProductDraftRepository } from "../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../saie/infrastructure/index.js";
import { AIProductImportPipelineService } from "../application/services/ai-product-import-pipeline.service.js";
import { ProductImportApiService } from "../application/services/product-import-api.service.js";
import { InMemoryProductImportRepository } from "../infrastructure/repositories/in-memory-product-import.repository.js";
import { createProductImportRouter } from "./product-import.routes.js";

const requestedAt = "2026-07-22T09:00:00.000Z";

const createIdGenerator = (prefix: string): (() => string) => {
  let nextId = 0;
  return () => `${prefix}-${(nextId += 1)}`;
};

const payload = (externalProductId = "api-001") => ({
  externalProductId,
  sourcePlatform: "generic",
  supplierName: "Lumora Supplier",
  supplierUrl: `https://supplier.test/products/${externalProductId}`,
  title: "Lumora Botanical Body Lotion",
  description:
    "A premium botanical body lotion with clean supplier data, beauty positioning, merchandising context, and enough structured detail for deterministic import testing.",
  brand: "Lumora",
  category: "Body Lotion",
  productType: "Body Care",
  images: [{ url: "https://images.test/api-lotion.jpg", altText: "Lumora lotion" }],
  variants: [
    {
      externalVariantId: `${externalProductId}:default`,
      sku: `SKU-${externalProductId}`,
      title: "Default Title",
      optionValues: { Title: "Default Title" },
      supplierPrice: 8,
      compareAtPrice: 28,
      currency: "USD",
      inventory: 20,
    },
  ],
  supplierPrice: 8,
  compareAtPrice: 28,
  currency: "USD",
  inventory: 20,
  shippingOrigin: "US",
  shippingDestinations: ["US", "GLOBAL"],
  estimatedDelivery: { minDays: 3, maxDays: 7 },
  tags: ["beauty"],
  rawMetadata: { token: "secret-value", safe: "metadata" },
});

const createTestApp = () => {
  const productImportRepository = new InMemoryProductImportRepository();
  const draftRepository = new InMemoryProductDraftRepository();
  const approvalRepository = new InMemoryApprovalRepository([]);
  const auditRepository = new InMemoryAuditRepository();
  const pipeline = new AIProductImportPipelineService({
    productImportRepository,
    draftService: new CreateProductDraftService({
      repository: draftRepository,
      idGenerator: createIdGenerator("draft"),
      clock: () => requestedAt,
    }),
    approvalRepository,
    auditRepository,
    idGenerator: createIdGenerator("import"),
    now: () => new Date(requestedAt),
  });
  const app = express();
  app.use(express.json());
  app.use("/api/product-imports", createProductImportRouter({
    service: new ProductImportApiService(pipeline, productImportRepository),
  }));
  app.use(errorHandler);

  return { app, productImportRepository, draftRepository, approvalRepository, auditRepository };
};

interface ApiSuccessBody<TData> {
  readonly success: true;
  readonly data: TData;
}

interface ApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: string;
  };
}

interface ProductImportTestResponse {
  readonly importId: string;
  readonly status: string;
  readonly pipelineStatus: string;
  readonly sourcePlatform: string;
  readonly externalProductId: string;
  readonly duplicate: boolean;
  readonly forced: boolean;
  readonly approvalId?: string;
  readonly productDraftId?: string;
  readonly idempotencyBehavior?: string;
  readonly idempotencyKey?: string;
  readonly parentImportId?: string;
}

interface ProductImportListTestResponse {
  readonly total: number;
  readonly items: readonly ProductImportTestResponse[];
}

const successBody = <TData>(body: unknown): ApiSuccessBody<TData> => body as ApiSuccessBody<TData>;
const errorBody = (body: unknown): ApiErrorBody => body as ApiErrorBody;

describe("product import API routes", () => {
  it("creates a draft-only import and returns a pending approval response", async () => {
    const { app, draftRepository, approvalRepository } = createTestApp();

    const response = await request(app)
      .post("/api/product-imports")
      .send({ sourcePlatform: "generic", payload: payload(), requestedBy: "merchant" })
      .expect(201);

    const body = successBody<ProductImportTestResponse>(response.body as unknown);
    expect(body).toMatchObject({
      success: true,
      data: {
        status: "PENDING_APPROVAL",
        pipelineStatus: "PENDING_APPROVAL",
        sourcePlatform: "generic",
        externalProductId: "api-001",
        duplicate: false,
        forced: false,
      },
    });
    expect(body.data.approvalId).toEqual(expect.any(String));
    expect(body.data.productDraftId).toEqual(expect.any(String));
    expect((await draftRepository.list()).items[0]?.status).toBe("draft");
    expect(approvalRepository.findById({ tenantId: "tenant-default", storeId: "store-default" }, body.data.approvalId ?? "")).toMatchObject({
      status: "pending",
      executionEnabled: false,
    });
  });

  it("rejects malformed payloads with the existing error envelope", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post("/api/product-imports")
      .send({ sourcePlatform: "generic", payload: { title: "Missing ID" } })
      .expect(400);

    expect(errorBody(response.body as unknown)).toMatchObject({
      success: false,
      error: {
        code: "PRODUCT_IMPORT_ADAPTER_FAILED",
      },
    });
  });

  it("returns duplicate imports without creating another draft", async () => {
    const { app, draftRepository } = createTestApp();

    await request(app).post("/api/product-imports").send({ sourcePlatform: "generic", payload: payload("duplicate-api") }).expect(201);
    const duplicate = await request(app).post("/api/product-imports").send({ sourcePlatform: "generic", payload: payload("duplicate-api") }).expect(200);

    expect(successBody<ProductImportTestResponse>(duplicate.body as unknown)).toMatchObject({
      success: true,
      data: {
        duplicate: true,
        idempotencyBehavior: "REPLAYED_EXISTING",
      },
    });
    expect((await draftRepository.list()).total).toBe(1);
  });

  it("retrieves imports, status, and filtered lists", async () => {
    const { app } = createTestApp();
    const created = await request(app).post("/api/product-imports").send({ sourcePlatform: "generic", payload: payload("get-api") }).expect(201);
    const importId = successBody<ProductImportTestResponse>(created.body as unknown).data.importId;

    await request(app).get(`/api/product-imports/${importId}`).expect(200).expect((response) => {
      expect(successBody<ProductImportTestResponse>(response.body as unknown).data).toMatchObject({ importId, idempotencyKey: "generic:get-api" });
    });
    await request(app).get(`/api/product-imports/${importId}/status`).expect(200).expect((response) => {
      expect(successBody<ProductImportTestResponse>(response.body as unknown).data).toMatchObject({ importId, status: "PENDING_APPROVAL" });
    });
    await request(app).get("/api/product-imports?status=PENDING_APPROVAL&limit=1").expect(200).expect((response) => {
      expect(successBody<ProductImportListTestResponse>(response.body as unknown).data).toMatchObject({ total: 1, items: [{ importId }] });
    });
  });

  it("returns not found for unknown or cross-tenant imports", async () => {
    const { app } = createTestApp();
    const created = await request(app)
      .post("/api/product-imports")
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .send({ sourcePlatform: "generic", payload: payload("tenant-api") })
      .expect(201);

    await request(app).get("/api/product-imports/missing-import").expect(404).expect((response) => {
      expect(errorBody(response.body as unknown).error.code).toBe("PRODUCT_IMPORT_NOT_FOUND");
    });
    const importId = successBody<ProductImportTestResponse>(created.body as unknown).data.importId;
    await request(app).get(`/api/product-imports/${importId}`).expect(404);
    await request(app)
      .get(`/api/product-imports/${importId}`)
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .expect(200);
  });

  it("retries imports as forced re-imports without overwriting historical records", async () => {
    const { app, productImportRepository } = createTestApp();
    const created = await request(app).post("/api/product-imports").send({ sourcePlatform: "generic", payload: payload("retry-api") }).expect(201);
    const importId = successBody<ProductImportTestResponse>(created.body as unknown).data.importId;

    const retried = await request(app)
      .post(`/api/product-imports/${importId}/retry`)
      .send({ requestedBy: "merchant-reviewer" })
      .expect(202);

    expect(successBody<ProductImportTestResponse>(retried.body as unknown)).toMatchObject({
      success: true,
      data: {
        forced: true,
        idempotencyBehavior: "FORCED_REIMPORT",
        parentImportId: importId,
      },
    });
    await expect(productImportRepository.list()).resolves.toMatchObject({ total: 2 });
  });

  it("does not call direct Shopify publish operations or auto-approve imports", async () => {
    const publishOperation = vi.fn();
    const { app, approvalRepository } = createTestApp();

    const created = await request(app).post("/api/product-imports").send({ sourcePlatform: "generic", payload: payload("safe-api") }).expect(201);
    const importId = successBody<ProductImportTestResponse>(created.body as unknown);

    expect(publishOperation).not.toHaveBeenCalled();
    expect(approvalRepository.findById({ tenantId: "tenant-default", storeId: "store-default" }, importId.data.approvalId ?? "")).toMatchObject({
      status: "pending",
      requiresHumanApproval: true,
    });
  });
});
