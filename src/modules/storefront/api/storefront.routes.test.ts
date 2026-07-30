import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../saie/infrastructure/index.js";
import { StorefrontFoundationService } from "../application/index.js";
import { InMemoryStorefrontRepository } from "../infrastructure/index.js";
import { createStorefrontRouter } from "./storefront.routes.js";

const profilePayload = {
  brandName: "Lumora Beauty",
  brandPositioning: "Premium skincare inspired by nature.",
  targetMarkets: ["US"],
  defaultLocale: "en-US",
  currency: "USD",
  industry: "beauty",
};

const createIdGenerator = (): (() => string) => {
  let id = 0;
  return () => `api-id-${(id += 1).toString().padStart(3, "0")}`;
};

const createApp = () => {
  const repository = new InMemoryStorefrontRepository();
  const service = new StorefrontFoundationService({
    repository,
    approvalRepository: new InMemoryApprovalRepository([]),
    auditRepository: new InMemoryAuditRepository(),
    now: () => new Date("2026-07-30T10:00:00.000Z"),
    idGenerator: createIdGenerator(),
  });
  const app = express();
  app.use(express.json());
  app.use("/api/storefront", createStorefrontRouter({ service }));
  app.use(errorHandler);
  return { app };
};

interface SuccessBody<TData> {
  readonly success: true;
  readonly data: TData;
}

interface StorefrontProjectResponse {
  readonly id: string;
  readonly status: string;
  readonly mode: string;
  readonly profileId?: string;
  readonly parentProjectId?: string;
  readonly approvalId?: string;
}

const successBody = <TData>(body: unknown): SuccessBody<TData> => body as SuccessBody<TData>;

describe("storefront foundation API routes", () => {
  it("creates profiles and PLAN_ONLY projects through the active public boundary", async () => {
    const { app } = createApp();
    const profileResponse = await request(app).post("/api/storefront/profiles").send(profilePayload).expect(201);
    const profileId = successBody<{ readonly id: string }>(profileResponse.body as unknown).data.id;

    const projectResponse = await request(app)
      .post("/api/storefront/projects")
      .send({ profileId, selectedProductDraftIds: ["draft-1"], requestedBy: "merchant" })
      .expect(201);

    const project = successBody<StorefrontProjectResponse>(projectResponse.body as unknown);
    expect(project).toMatchObject({
      success: true,
      data: {
        status: "PENDING_REVIEW",
        mode: "PLAN_ONLY",
      },
    });
    expect(typeof project.data.approvalId).toBe("string");
  });

  it("returns duplicate projects without creating another active project", async () => {
    const { app } = createApp();
    const profile = await request(app).post("/api/storefront/profiles").send(profilePayload).expect(201);
    const profileId = successBody<{ readonly id: string }>(profile.body as unknown).data.id;

    const first = await request(app).post("/api/storefront/projects").send({ profileId, selectedProductDraftIds: ["draft-dup"] }).expect(201);
    const replay = await request(app).post("/api/storefront/projects").send({ profileId, selectedProductDraftIds: ["draft-dup"] }).expect(201);

    expect(successBody<StorefrontProjectResponse>(replay.body as unknown).data.id).toBe(successBody<StorefrontProjectResponse>(first.body as unknown).data.id);
  });

  it("supports forced project lineage and status reads", async () => {
    const { app } = createApp();
    const profile = await request(app).post("/api/storefront/profiles").send(profilePayload).expect(201);
    const profileId = successBody<{ readonly id: string }>(profile.body as unknown).data.id;
    const first = await request(app).post("/api/storefront/projects").send({ profileId, selectedProductDraftIds: ["draft-force"] }).expect(201);
    const firstId = successBody<StorefrontProjectResponse>(first.body as unknown).data.id;

    const forced = await request(app).post("/api/storefront/projects").send({ profileId, selectedProductDraftIds: ["draft-force"], force: true }).expect(202);
    expect(successBody<StorefrontProjectResponse>(forced.body as unknown).data.parentProjectId).toBe(firstId);
    await request(app).get(`/api/storefront/projects/${firstId}/status`).expect(200).expect((response) => {
      expect(successBody<StorefrontProjectResponse>(response.body as unknown).data).toMatchObject({ status: "PENDING_REVIEW", mode: "PLAN_ONLY" });
    });
  });

  it("rejects inactive generation modes and inactive preview endpoints", async () => {
    const { app } = createApp();
    const profile = await request(app).post("/api/storefront/profiles").send(profilePayload).expect(201);
    const profileId = successBody<{ readonly id: string }>(profile.body as unknown).data.id;

    await request(app).post("/api/storefront/projects").send({ profileId, mode: "GENERATE_ARTIFACTS" }).expect(400);
    await request(app).get("/api/storefront/projects/storefront-project:any/preview").expect(404);
    await request(app).get("/api/storefront/projects/storefront-project:any/artifacts").expect(404);
  });

  it("keeps tenant and store records isolated", async () => {
    const { app } = createApp();
    const profile = await request(app)
      .post("/api/storefront/profiles")
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .send(profilePayload)
      .expect(201);
    const profileId = successBody<{ readonly id: string }>(profile.body as unknown).data.id;
    const project = await request(app)
      .post("/api/storefront/projects")
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .send({ profileId })
      .expect(201);
    const projectId = successBody<StorefrontProjectResponse>(project.body as unknown).data.id;

    await request(app).get(`/api/storefront/projects/${projectId}`).expect(404);
    await request(app)
      .get(`/api/storefront/projects/${projectId}`)
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .expect(200);
  });
});
