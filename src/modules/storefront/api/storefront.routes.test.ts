import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import type { ProductDraft } from "../../product-draft/domain/models/product-draft.model.js";
import { InMemoryProductDraftRepository } from "../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../saie/infrastructure/index.js";
import { ArtifactPreviewService, StorefrontFoundationService, StorefrontPlanningService, ThemeMappingService } from "../application/index.js";
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
  const productDraftRepository = new InMemoryProductDraftRepository();
  void productDraftRepository.save(productDraft("draft-1", "Velvet Glow"));
  const service = new StorefrontFoundationService({
    repository,
    approvalRepository: new InMemoryApprovalRepository([]),
    auditRepository: new InMemoryAuditRepository(),
    now: () => new Date("2026-07-30T10:00:00.000Z"),
    idGenerator: createIdGenerator(),
  });
  const planningService = new StorefrontPlanningService({
    storefrontRepository: repository,
    productDraftRepository,
    approvalRepository: new InMemoryApprovalRepository([]),
    auditRepository: new InMemoryAuditRepository(),
    now: () => new Date("2026-07-30T10:00:00.000Z"),
    idGenerator: createIdGenerator(),
  });
  const themeMappingService = new ThemeMappingService({
    storefrontRepository: repository,
    approvalRepository: new InMemoryApprovalRepository([]),
    auditRepository: new InMemoryAuditRepository(),
    now: () => new Date("2026-07-30T10:00:00.000Z"),
    idGenerator: createIdGenerator(),
  });
  const artifactPreviewService = new ArtifactPreviewService({
    storefrontRepository: repository,
    approvalRepository: new InMemoryApprovalRepository([]),
    auditRepository: new InMemoryAuditRepository(),
    now: () => new Date("2026-07-30T10:00:00.000Z"),
    idGenerator: createIdGenerator(),
  });
  const app = express();
  app.use(express.json());
  app.use("/api/storefront", createStorefrontRouter({ service, planningService, themeMappingService, artifactPreviewService }));
  app.use(errorHandler);
  return { app };
};

const productDraft = (id: string, title: string): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: "2026-07-30T10:00:00.000Z" },
  title,
  description: `${title} is approved for storefront planning.`,
  brand: "Lumora",
  category: "Body Care",
  productType: "Body Lotion",
  tags: ["premium", "natural"],
  targetMarkets: ["US"],
  images: [{ id: `${id}-image`, sourceUrl: `https://images.test/${id}.jpg`, position: 1, selected: true, primary: true }],
  variants: [{
    id: `${id}-variant`,
    title: "Default Title",
    options: [{ name: "Title", value: "Default Title" }],
    supplierPrice: { amount: 8, currency: "USD" },
    sellingPrice: { amount: 24, currency: "USD" },
    available: true,
  }],
  createdAt: "2026-07-30T10:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
});

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

  it("plans projects and returns the stored planning report", async () => {
    const { app } = createApp();
    const profile = await request(app).post("/api/storefront/profiles").send(profilePayload).expect(201);
    const profileId = successBody<{ readonly id: string }>(profile.body as unknown).data.id;
    const project = await request(app).post("/api/storefront/projects").send({ profileId, selectedProductDraftIds: ["draft-1"] }).expect(201);
    const projectId = successBody<StorefrontProjectResponse>(project.body as unknown).data.id;

    await request(app).post(`/api/storefront/projects/${projectId}/plan`).send({ requestedBy: "merchant" }).expect(200).expect((response) => {
      expect(successBody<StorefrontProjectResponse>(response.body as unknown).data).toMatchObject({
        id: projectId,
        status: "PENDING_REVIEW",
      });
    });
    await request(app).get(`/api/storefront/projects/${projectId}/plan`).expect(200).expect((response) => {
      expect(successBody<{ readonly homepage: { readonly sections: readonly { readonly type: string }[] } }>(response.body as unknown).data.homepage.sections.map((section) => section.type)).toContain("hero-banner");
    });
    await request(app).get(`/api/storefront/projects/${projectId}/planning-report`).expect(200).expect((response) => {
      const report = successBody<{ readonly score: { readonly overall: number }; readonly validation: { readonly requiresReview: boolean } }>(response.body as unknown).data;
      expect(report).toMatchObject({
        validation: { requiresReview: true },
      });
      expect(typeof report.score.overall).toBe("number");
    });
  });

  it("creates and reads Shopify theme mapping preview artifacts", async () => {
    const { app } = createApp();
    const profile = await request(app).post("/api/storefront/profiles").send(profilePayload).expect(201);
    const profileId = successBody<{ readonly id: string }>(profile.body as unknown).data.id;
    const project = await request(app).post("/api/storefront/projects").send({ profileId, selectedProductDraftIds: ["draft-1"] }).expect(201);
    const projectId = successBody<StorefrontProjectResponse>(project.body as unknown).data.id;
    await request(app).post(`/api/storefront/projects/${projectId}/plan`).send({ requestedBy: "merchant" }).expect(200);

    await request(app).post(`/api/storefront/projects/${projectId}/theme-mapping`).send({ requestedBy: "merchant" }).expect(200).expect((response) => {
      const result = successBody<{ readonly project: { readonly status: string }; readonly previewArtifacts: readonly { readonly path: string }[] }>(response.body as unknown).data;
      expect(result.project.status).toBe("PENDING_REVIEW");
      expect(result.previewArtifacts.map((artifact) => artifact.path)).toEqual(expect.arrayContaining(["theme-preview/theme-mapping.json", "theme-preview/homepage.json"]));
    });
    await request(app).get(`/api/storefront/projects/${projectId}/theme-mapping`).expect(200).expect((response) => {
      expect(successBody<{ readonly homepage: { readonly path: string } }>(response.body as unknown).data.homepage.path).toBe("templates/index.json");
    });
    await request(app).get(`/api/storefront/projects/${projectId}/theme-preview`).expect(200).expect((response) => {
      expect(successBody<{ readonly preview: { readonly previewUrl: string | null }; readonly artifacts: readonly unknown[] }>(response.body as unknown).data).toMatchObject({
        preview: { previewUrl: null },
      });
    });
  });

  it("creates and reads theme artifact preview bundles", async () => {
    const { app } = createApp();
    const profile = await request(app).post("/api/storefront/profiles").send(profilePayload).expect(201);
    const profileId = successBody<{ readonly id: string }>(profile.body as unknown).data.id;
    const project = await request(app).post("/api/storefront/projects").send({ profileId, selectedProductDraftIds: ["draft-1"] }).expect(201);
    const projectId = successBody<StorefrontProjectResponse>(project.body as unknown).data.id;
    await request(app).post(`/api/storefront/projects/${projectId}/plan`).send({ requestedBy: "merchant" }).expect(200);
    await request(app).post(`/api/storefront/projects/${projectId}/theme-mapping`).send({ requestedBy: "merchant" }).expect(200);

    await request(app).post(`/api/storefront/projects/${projectId}/artifacts`).send({ requestedBy: "merchant" }).expect(200).expect((response) => {
      const result = successBody<{ readonly project: { readonly status: string }; readonly generation: { readonly bundle: { readonly artifactCount: number; readonly bundleHash: string } } }>(response.body as unknown).data;
      expect(result.project.status).toBe("PENDING_REVIEW");
      expect(result.generation.bundle.artifactCount).toBe(14);
      expect(result.generation.bundle.bundleHash).toHaveLength(64);
    });
    await request(app).get(`/api/storefront/projects/${projectId}/artifacts`).expect(200).expect((response) => {
      expect(successBody<readonly { readonly path: string }[]>(response.body as unknown).data.map((artifact) => artifact.path)).toEqual(expect.arrayContaining(["theme-preview/manifest.json", "theme-preview/bundle.json"]));
    });
    await request(app).get(`/api/storefront/projects/${projectId}/artifact-bundle`).expect(200).expect((response) => {
      expect(successBody<{ readonly artifactValidationScore: number; readonly artifactCount: number }>(response.body as unknown).data).toMatchObject({
        artifactValidationScore: 100,
        artifactCount: 14,
      });
    });
    await request(app).get(`/api/storefront/projects/${projectId}/artifact-validation`).expect(200).expect((response) => {
      expect(successBody<{ readonly errors: readonly unknown[]; readonly requiresHumanReview: boolean }>(response.body as unknown).data).toMatchObject({
        errors: [],
        requiresHumanReview: true,
      });
    });
  });
});
