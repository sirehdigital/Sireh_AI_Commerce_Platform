import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { InMemoryProductDraftRepository } from "../../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { InMemoryStorefrontRepository } from "../../infrastructure/index.js";
import { StorefrontFoundationService } from "./storefront-foundation.service.js";
import { StorefrontPlanningService } from "./storefront-planning.service.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T11:00:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `planning-id-${(id += 1).toString().padStart(3, "0")}`;
};

const approvedDraft = (id: string, title: string): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: now.toISOString() },
  title,
  description: `${title} is approved for deterministic planning.`,
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
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});

const createServices = async () => {
  const storefrontRepository = new InMemoryStorefrontRepository();
  const productDraftRepository = new InMemoryProductDraftRepository();
  const approvalRepository = new InMemoryApprovalRepository([]);
  const auditRepository = new InMemoryAuditRepository();
  await productDraftRepository.save(approvedDraft("draft-1", "Velvet Glow"));
  await productDraftRepository.save(approvedDraft("draft-2", "Silk Wash"));
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
  const profile = await foundation.createProfile({
    brandName: "Lumora Beauty",
    brandPositioning: "Premium skincare inspired by nature.",
    targetMarkets: ["US"],
    defaultLocale: "en-US",
    currency: "USD",
    industry: "beauty",
    trustStyle: ["Fast Shipping", "Secure Checkout", "30-Day Satisfaction"],
  }, tenant);
  const project = await foundation.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-1", "draft-2"] }, tenant);
  return { planning, storefrontRepository, approvalRepository, auditRepository, project };
};

describe("StorefrontPlanningService", () => {
  it("creates a complete deterministic storefront plan and stores score snapshots", async () => {
    const { planning, storefrontRepository, project } = await createServices();

    const planned = await planning.planProject({ projectId: project.id, requestedBy: "merchant" }, tenant);

    expect(planned.status).toBe("PENDING_REVIEW");
    expect(planned.planSnapshot.homepage.sections.some((section) => section.type === "hero-banner")).toBe(true);
    expect(planned.planSnapshot.productPages).toHaveLength(2);
    expect(planned.planSnapshot.collections.length).toBeGreaterThan(0);
    expect(planned.planSnapshot.navigation.mainMenu.map((item) => item.label)).toEqual(expect.arrayContaining(["Shop", "About", "FAQ", "Contact"]));
    expect(planned.validationSnapshot.errors).toEqual([]);
    expect(planned.qualitySnapshot.overallScore).toBeGreaterThan(70);
    await expect(storefrontRepository.findProjectById(planned.id)).resolves.toMatchObject({ id: planned.id, status: "PENDING_REVIEW" });
  });

  it("returns stored plan and planning report", async () => {
    const { planning, project } = await createServices();
    const planned = await planning.planProject({ projectId: project.id }, tenant);

    await expect(planning.getPlan(project.id, tenant)).resolves.toEqual(planned.planSnapshot);
    await expect(planning.getPlanningReport(project.id, tenant)).resolves.toMatchObject({
      validation: { errors: [], requiresReview: true },
      score: { overall: planned.qualitySnapshot.overallScore },
    });
  });

  it("writes planning audit records without live Shopify operations", async () => {
    const { planning, auditRepository, project } = await createServices();

    await planning.planProject({ projectId: project.id, correlationId: "corr-plan" }, tenant);

    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toEqual(expect.arrayContaining([
      "PLANNING_STARTED",
      "PLANNING_COMPLETED",
      "PLANNING_SCORE_UPDATED",
    ]));
  });

  it("rejects unapproved product drafts before planning", async () => {
    const { planning } = await createServices();
    const storefrontRepository = new InMemoryStorefrontRepository();
    const draftRepository = new InMemoryProductDraftRepository();
    await draftRepository.save({ ...approvedDraft("draft-1", "Velvet Glow"), status: "draft" });
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
    const project = await foundation.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-1"] }, tenant);
    const blockedPlanning = new StorefrontPlanningService({
      storefrontRepository,
      productDraftRepository: draftRepository,
    });

    await expect(planning.planProject({ projectId: "missing" }, tenant)).rejects.toMatchObject({ code: "STOREFRONT_PROJECT_NOT_FOUND" });
    await expect(blockedPlanning.planProject({ projectId: project.id }, tenant)).rejects.toMatchObject({ code: "STOREFRONT_PRODUCT_DRAFT_NOT_APPROVED" });
  });
});
