import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { InMemorySupplierIntegrationRepository } from "../infrastructure/repositories/in-memory-supplier-integration.repository.js";
import { FakeSupplierProvider } from "../infrastructure/providers/fake-supplier.provider.js";
import { SupplierIntegrationEngineService } from "../application/services/supplier-integration-engine.service.js";
import { createAutoDSRouter } from "./autods.routes.js";

const fixedDate = new Date("2026-07-22T10:00:00.000Z");

const createApp = () => {
  let id = 0;
  const service = new SupplierIntegrationEngineService({
    repository: new InMemorySupplierIntegrationRepository(),
    providers: [new FakeSupplierProvider({ now: () => fixedDate.toISOString() })],
    now: () => fixedDate,
    idGenerator: () => `api-id-${(id += 1)}`,
  });
  const app = express();
  app.use(express.json());
  app.use("/api/autods", createAutoDSRouter({ service }));
  app.use(errorHandler);
  return app;
};

interface ApiSuccessBody<TData> {
  readonly success: true;
  readonly data: TData;
}

const successBody = <TData>(body: unknown): ApiSuccessBody<TData> => body as ApiSuccessBody<TData>;

describe("AutoDS API routes", () => {
  it("connects, reports status, and checks health", async () => {
    const app = createApp();

    await request(app)
      .post("/api/autods/connect")
      .send({ provider: "fake", credentialsReferenceId: "vault/autods/test" })
      .expect(201)
      .expect((response) => {
        expect(successBody<{ readonly status: string }>(response.body as unknown).data.status).toBe("CONNECTED");
      });

    await request(app).get("/api/autods/status?provider=fake").expect(200).expect((response) => {
      expect(successBody<{ readonly connection: { readonly status: string } }>(response.body as unknown).data.connection.status).toBe("CONNECTED");
    });
    await request(app).get("/api/autods/health?provider=fake").expect(200).expect((response) => {
      expect(successBody<{ readonly status: string }>(response.body as unknown).data.status).toBe("ONLINE");
    });
  });

  it("creates import and sync jobs without publishing to Shopify", async () => {
    const app = createApp();

    const imported = await request(app)
      .post("/api/autods/import")
      .send({ provider: "fake", requestedBy: "merchant" })
      .expect(201);
    expect(successBody<{ readonly status: string; readonly productReferenceIds: readonly string[] }>(imported.body as unknown).data).toMatchObject({
      status: "completed",
      productReferenceIds: ["supplier-product:tenant-default:store-default:fake:fake-product-001"],
    });

    await request(app)
      .post("/api/autods/sync")
      .send({ provider: "fake", syncType: "inventory" })
      .expect(202)
      .expect((response) => {
        expect(successBody<{ readonly status: string }>(response.body as unknown).data.status).toBe("completed");
      });
  });

  it("lists jobs and returns validation errors through the shared error handler", async () => {
    const app = createApp();

    await request(app).post("/api/autods/import").send({ provider: "fake", requestedBy: "merchant" }).expect(201);
    await request(app).get("/api/autods/jobs").expect(200).expect((response) => {
      expect(successBody<{ readonly total: number }>(response.body as unknown).data.total).toBe(1);
    });
    await request(app).post("/api/autods/sync").send({ provider: "fake", syncType: "unknown" }).expect(400);
  });
});
