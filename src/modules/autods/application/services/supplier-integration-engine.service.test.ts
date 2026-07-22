import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../../../shared/errors/app-error.js";
import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import type { SupplierProvider } from "../providers/supplier-provider.js";
import { InMemorySupplierIntegrationRepository } from "../../infrastructure/repositories/in-memory-supplier-integration.repository.js";
import { FakeSupplierProvider, createFakeSupplierProduct } from "../../infrastructure/providers/fake-supplier.provider.js";
import { SupplierIntegrationEngineService, type SupplierProductImportApi } from "./supplier-integration-engine.service.js";

const tenant: TenantContext = {
  tenantId: "tenant-test",
  storeId: "store-test",
  shopDomain: "lumora-test.myshopify.com",
};

const fixedDate = new Date("2026-07-22T10:00:00.000Z");

const idGenerator = () => {
  let index = 0;
  return () => `id-${(index += 1)}`;
};

const createImportApi = () => {
  const startImport = vi.fn<SupplierProductImportApi["startImport"]>((request) => Promise.resolve({
    importId: `product-import:${payloadRecord(request.payload).externalProductId}`,
    status: "PENDING_APPROVAL",
    pipelineStatus: "PENDING_APPROVAL",
    sourcePlatform: request.sourcePlatform,
    externalProductId: payloadRecord(request.payload).externalProductId,
    duplicate: false,
    forced: request.forceReimport,
    idempotencyKey: `${request.sourcePlatform}:${payloadRecord(request.payload).externalProductId}`,
    idempotencyBehavior: request.forceReimport ? "FORCED_REIMPORT" : "CREATED",
    warnings: [],
    createdAt: fixedDate.toISOString(),
    updatedAt: fixedDate.toISOString(),
  }));

  return { startImport };
};

const createService = (input: {
  readonly provider?: SupplierProvider;
  readonly importApi?: SupplierProductImportApi;
} = {}) => {
  const repository = new InMemorySupplierIntegrationRepository();
  const auditRepository = new InMemoryAuditRepository();
  const service = new SupplierIntegrationEngineService({
    repository,
    auditRepository,
    providers: [input.provider ?? new FakeSupplierProvider({ now: () => fixedDate.toISOString() })],
    now: () => fixedDate,
    idGenerator: idGenerator(),
    ...(input.importApi === undefined ? {} : { productImportApi: input.importApi }),
  });

  return { service, repository, auditRepository };
};

describe("SupplierIntegrationEngineService", () => {
  it("connects without storing raw credentials and records health", async () => {
    const { service } = createService();

    const connection = await service.connect({
      provider: "fake",
      credentialsReference: { referenceId: "vault/autods/test", provider: "fake", label: "test" },
    }, tenant);

    expect(connection).toMatchObject({
      supplierProvider: "fake",
      status: "CONNECTED",
      credentialsReference: { referenceId: "vault/autods/test", provider: "fake" },
      health: { status: "ONLINE" },
    });
    expect(JSON.stringify(connection)).not.toContain("accessToken");
  });

  it("imports supplier products through the product import approval pipeline port", async () => {
    const importApi = createImportApi();
    const { service } = createService({ importApi });

    const job = await service.importProducts({ provider: "fake", requestedBy: "merchant" }, tenant);

    expect(job).toMatchObject({
      status: "completed",
      productReferenceIds: ["supplier-product:tenant-test:store-test:fake:fake-product-001"],
      productImportIds: ["product-import:fake-product-001"],
    });
    expect(importApi.startImport).toHaveBeenCalledWith(expect.objectContaining({
      sourcePlatform: "generic",
      requestedBy: "merchant",
      forceReimport: false,
    }), tenant);
  });

  it("returns an existing import job for duplicate requests unless forced", async () => {
    const importApi = createImportApi();
    const { service } = createService({ importApi });

    const first = await service.importProducts({ provider: "fake", requestedBy: "merchant" }, tenant);
    const duplicate = await service.importProducts({ provider: "fake", requestedBy: "merchant" }, tenant);
    const forced = await service.importProducts({ provider: "fake", requestedBy: "merchant", force: true }, tenant);

    expect(duplicate.id).toBe(first.id);
    expect(forced.id).not.toBe(first.id);
    expect(importApi.startImport).toHaveBeenCalledTimes(2);
  });

  it("syncs inventory, pricing, media, and shipping as supplier snapshots only", async () => {
    const { service, repository } = createService();

    for (const syncType of ["inventory", "pricing", "media", "shipping", "full"] as const) {
      const job = await service.sync({ provider: "fake", syncType }, tenant);
      expect(job.status).toBe("completed");
      expect(job.productReferenceIds).toHaveLength(1);
    }

    await expect(repository.listSyncJobs({ tenantId: tenant.tenantId, storeId: tenant.storeId })).resolves.toMatchObject({ total: 5 });
  });

  it("stores provider failures as failed jobs and audit records", async () => {
    const failingProvider = new FakeSupplierProvider({ now: () => fixedDate.toISOString() });
    vi.spyOn(failingProvider, "importProducts").mockResolvedValue({
      ok: false,
      warnings: [],
      failure: { code: "RATE_LIMITED", message: "Rate limited.", retryable: true, rateLimited: true },
    });
    const { service, auditRepository } = createService({ provider: failingProvider });

    const job = await service.importProducts({ provider: "fake", requestedBy: "merchant" }, tenant);

    expect(job).toMatchObject({
      status: "failed",
      failure: { code: "RATE_LIMITED", retryable: true, rateLimited: true },
    });
    const audits = auditRepository.list({ tenantId: tenant.tenantId, storeId: tenant.storeId });
    expect(audits.some((audit) =>
      audit.eventType === "preview.agent-activity" &&
      audit.details.supplierEventType === "supplier.import.failed",
    )).toBe(true);
  });

  it("updates connection health status without making network assumptions", async () => {
    const { service } = createService();
    await service.connect({ provider: "fake", credentialsReference: { referenceId: "vault/ref", provider: "fake" } }, tenant);

    await expect(service.health("fake", tenant)).resolves.toMatchObject({ status: "ONLINE" });
    await expect(service.status("fake", tenant)).resolves.toMatchObject({
      connection: { status: "CONNECTED" },
      health: { status: "ONLINE" },
    });
  });

  it("rejects missing credential references and unsupported providers with AppError", async () => {
    const { service } = createService();

    await expect(service.connect({
      provider: "fake",
      credentialsReference: { referenceId: " ", provider: "fake" },
    }, tenant)).rejects.toMatchObject({ code: "SUPPLIER_INPUT_INVALID" });
    await expect(service.health("missing", tenant)).rejects.toBeInstanceOf(AppError);
  });

  it("does not call product imports when product import API is not supplied", async () => {
    const product = createFakeSupplierProduct({ externalProductId: "references-only" });
    const { service } = createService({ provider: new FakeSupplierProvider({ products: [product], now: () => fixedDate.toISOString() }) });

    const job = await service.importProducts({ provider: "fake", requestedBy: "merchant" }, tenant);

    expect(job.status).toBe("completed");
    expect(job.productReferenceIds).toHaveLength(1);
    expect(job.productImportIds).toHaveLength(0);
  });
});

function payloadRecord(payload: unknown): { readonly externalProductId: string } {
  return payload as { readonly externalProductId: string };
}
