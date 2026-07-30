import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { InMemoryProductDraftRepository } from "../../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { InMemoryStorefrontRepository } from "../../infrastructure/index.js";
import { ArtifactPreviewService } from "./artifact-preview.service.js";
import { StorefrontFoundationService } from "./storefront-foundation.service.js";
import { StorefrontPlanningService } from "./storefront-planning.service.js";
import { ThemeMappingService } from "./theme-mapping.service.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T13:45:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `artifact-id-${(id += 1).toString().padStart(3, "0")}`;
};

const approvedDraft = (id: string, title: string): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: now.toISOString() },
  title,
  description: `${title} is approved for artifact preview generation.`,
  brand: "Lumora",
  category: "Body Care",
  productType: "Body Lotion",
  tags: ["premium", "natural"],
  targetMarkets: ["US"],
  images: [{ id: `${id}-image`, sourceUrl: `https://images.test/${id}.jpg`, altText: title, position: 1, selected: true, primary: true }],
  variants: [{
    id: `${id}-variant`,
    title: "Default Title",
    options: [{ name: "Title", value: "Default Title" }],
    supplierPrice: { amount: 8, currency: "USD" },
    sellingPrice: { amount: 24, currency: "USD" },
    available: true,
  }],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});

const createServices = async () => {
  const storefrontRepository = new InMemoryStorefrontRepository();
  const productDraftRepository = new InMemoryProductDraftRepository();
  const approvalRepository = new InMemoryApprovalRepository([]);
  const auditRepository = new InMemoryAuditRepository();
  await productDraftRepository.save(approvedDraft("draft-1", "Velvet Glow"));
  const foundation = new StorefrontFoundationService({
    repository: storefrontRepository,
    approvalRepository,
    auditRepository,
    now: () => now,
    idGenerator: idGenerator(),
  });
  const planning = new StorefrontPlanningService({
    storefrontRepository,
    productDraftRepository,
    approvalRepository,
    auditRepository,
    now: () => now,
    idGenerator: idGenerator(),
  });
  const themeMapping = new ThemeMappingService({
    storefrontRepository,
    approvalRepository,
    auditRepository,
    now: () => now,
    idGenerator: idGenerator(),
  });
  const artifactPreview = new ArtifactPreviewService({
    storefrontRepository,
    approvalRepository,
    auditRepository,
    now: () => now,
    idGenerator: idGenerator(),
  });
  const profile = await foundation.createProfile({
    brandName: "Lumora Beauty",
    brandPositioning: "Premium skincare inspired by nature.",
    targetMarkets: ["US"],
    defaultLocale: "en-US",
    currency: "USD",
    industry: "beauty",
    trustStyle: ["Cruelty Free", "Natural Ingredients", "Secure Checkout"],
  }, tenant);
  const project = await foundation.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-1"] }, tenant);
  const planned = await planning.planProject({ projectId: project.id, requestedBy: "merchant" }, tenant);
  await themeMapping.mapProject({ projectId: planned.id, requestedBy: "merchant" }, tenant);
  return { storefrontRepository, approvalRepository, auditRepository, artifactPreview, planned };
};

describe("ArtifactPreviewService", () => {
  it("generates a validated preview artifact bundle and keeps approval pending", async () => {
    const { storefrontRepository, approvalRepository, artifactPreview, planned } = await createServices();

    const result = await artifactPreview.generatePreview({ projectId: planned.id, requestedBy: "merchant", correlationId: "corr-artifact" }, tenant);
    const savedArtifacts = await storefrontRepository.listArtifacts(planned.id);

    expect(result.project.status).toBe("PENDING_REVIEW");
    expect(result.project.mode).toBe("PLAN_ONLY");
    expect(result.preview.previewStatus).toBe("ARTIFACT_PREVIEW");
    expect(result.preview.previewUrl).toBeNull();
    expect(result.generation.bundle.artifactCount).toBe(14);
    expect(result.generation.validation.errors).toEqual([]);
    expect(savedArtifacts.map((artifact) => artifact.path)).toEqual(expect.arrayContaining([
      "theme-preview/theme-mapping.json",
      "theme-preview/manifest.json",
      "theme-preview/bundle.json",
    ]));
    expect(savedArtifacts.map((artifact) => artifact.artifactType)).not.toEqual(expect.arrayContaining(["DEPLOYMENT_MANIFEST", "ROLLBACK_MANIFEST"]));
    expect(approvalRepository.findById(tenant, result.project.approvalId ?? "")).toMatchObject({
      status: "pending",
      executionEnabled: false,
      requiresHumanApproval: true,
    });
  });

  it("returns stored artifacts, bundle, and validation", async () => {
    const { artifactPreview, planned } = await createServices();
    await artifactPreview.generatePreview({ projectId: planned.id }, tenant);

    await expect(artifactPreview.listArtifacts(planned.id, tenant)).resolves.toHaveLength(14);
    await expect(artifactPreview.getBundle(planned.id, tenant)).resolves.toMatchObject({
      projectId: planned.id,
      artifactValidationScore: 100,
      artifactCount: 14,
    });
    await expect(artifactPreview.getValidation(planned.id, tenant)).resolves.toMatchObject({
      errors: [],
      requiresHumanReview: true,
    });
  });

  it("writes generation, validation, and completion audit records", async () => {
    const { auditRepository, artifactPreview, planned } = await createServices();

    await artifactPreview.generatePreview({ projectId: planned.id, correlationId: "corr-artifact" }, tenant);

    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toEqual(expect.arrayContaining([
      "ARTIFACT_GENERATION_STARTED",
      "ARTIFACT_VALIDATED",
      "ARTIFACT_GENERATION_COMPLETED",
    ]));
  });

  it("requires theme mapping before preview artifact generation", async () => {
    const storefrontRepository = new InMemoryStorefrontRepository();
    const artifactPreview = new ArtifactPreviewService({ storefrontRepository });
    const foundation = new StorefrontFoundationService({
      repository: storefrontRepository,
      now: () => now,
      idGenerator: idGenerator(),
    });
    const profile = await foundation.createProfile({
      brandName: "Lumora Beauty",
      brandPositioning: "Premium skincare inspired by nature.",
      targetMarkets: ["US"],
      defaultLocale: "en-US",
      currency: "USD",
      industry: "beauty",
    }, tenant);
    const project = await foundation.createProject({ profileId: profile.id }, tenant);

    await expect(artifactPreview.generatePreview({ projectId: project.id }, tenant)).rejects.toMatchObject({ code: "STOREFRONT_THEME_MAPPING_REQUIRED" });
  });
});
