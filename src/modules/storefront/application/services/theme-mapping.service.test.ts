import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { InMemoryProductDraftRepository } from "../../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { InMemoryStorefrontRepository } from "../../infrastructure/index.js";
import { StorefrontFoundationService } from "./storefront-foundation.service.js";
import { StorefrontPlanningService } from "./storefront-planning.service.js";
import { ThemeMappingService } from "./theme-mapping.service.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T12:30:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `theme-map-id-${(id += 1).toString().padStart(3, "0")}`;
};

const approvedDraft = (id: string, title: string): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: now.toISOString() },
  title,
  description: `${title} is approved for theme mapping.`,
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
  return { storefrontRepository, approvalRepository, auditRepository, themeMapping, planned };
};

describe("ThemeMappingService", () => {
  it("creates preview artifacts, keeps approval pending, and never creates live deployment artifacts", async () => {
    const { storefrontRepository, approvalRepository, themeMapping, planned } = await createServices();

    const result = await themeMapping.mapProject({ projectId: planned.id, requestedBy: "merchant", correlationId: "corr-theme" }, tenant);
    const savedArtifacts = await storefrontRepository.listArtifacts(planned.id);

    expect(result.project.status).toBe("PENDING_REVIEW");
    expect(result.project.mode).toBe("PLAN_ONLY");
    expect(result.approvalId).toBe(planned.approvalId);
    expect(approvalRepository.findById(tenant, result.project.approvalId ?? "")).toMatchObject({
      status: "pending",
      executionEnabled: false,
      requiresHumanApproval: true,
    });
    expect(savedArtifacts.map((artifact) => artifact.path)).toEqual(expect.arrayContaining(["theme-preview/theme-mapping.json", "theme-preview/homepage.json"]));
    expect(savedArtifacts.map((artifact) => artifact.artifactType)).not.toEqual(expect.arrayContaining(["DEPLOYMENT_MANIFEST", "ROLLBACK_MANIFEST"]));
    expect(savedArtifacts.every((artifact) => artifact.format === "json" && artifact.status === "GENERATED")).toBe(true);
  });

  it("returns persisted mapping and preview models", async () => {
    const { themeMapping, planned } = await createServices();
    await themeMapping.mapProject({ projectId: planned.id }, tenant);

    await expect(themeMapping.getThemeMapping(planned.id, tenant)).resolves.toMatchObject({
      projectId: planned.id,
      homepage: { path: "templates/index.json" },
    });
    await expect(themeMapping.getThemePreview(planned.id, tenant)).resolves.toMatchObject({
      projectId: planned.id,
      status: "PENDING_REVIEW",
      preview: {
        previewStatus: "CONFIGURATION_PREVIEW",
        previewUrl: null,
      },
    });
  });

  it("writes start, validation, and completion audit records", async () => {
    const { auditRepository, themeMapping, planned } = await createServices();

    await themeMapping.mapProject({ projectId: planned.id, correlationId: "corr-theme" }, tenant);

    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toEqual(expect.arrayContaining([
      "THEME_MAPPING_STARTED",
      "THEME_MAPPING_VALIDATED",
      "THEME_MAPPING_COMPLETED",
    ]));
  });

  it("requires a planned project before theme mapping", async () => {
    const storefrontRepository = new InMemoryStorefrontRepository();
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
    const themeMapping = new ThemeMappingService({ storefrontRepository });

    await expect(themeMapping.mapProject({ projectId: project.id }, tenant)).rejects.toMatchObject({ code: "STOREFRONT_PLAN_REQUIRED" });
  });
});
