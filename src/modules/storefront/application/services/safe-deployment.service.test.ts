import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { InMemoryProductDraftRepository } from "../../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { FakeDeploymentGateway } from "../deployment/index.js";
import { InMemoryStorefrontRepository } from "../../infrastructure/index.js";
import { ArtifactPreviewService } from "./artifact-preview.service.js";
import { SafeDeploymentService } from "./safe-deployment.service.js";
import { StorefrontFoundationService } from "./storefront-foundation.service.js";
import { StorefrontPlanningService } from "./storefront-planning.service.js";
import { ThemeMappingService } from "./theme-mapping.service.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T15:30:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `deploy-id-${(id += 1).toString().padStart(3, "0")}`;
};

const approvedDraft = (id: string, title: string): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: now.toISOString() },
  title,
  description: `${title} is approved for safe deployment tests.`,
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

const createPreviewReadyProject = async () => {
  const storefrontRepository = new InMemoryStorefrontRepository();
  const productDraftRepository = new InMemoryProductDraftRepository();
  const approvalRepository = new InMemoryApprovalRepository([]);
  const auditRepository = new InMemoryAuditRepository();
  await productDraftRepository.save(approvedDraft("draft-1", "Velvet Glow"));
  const clock = () => now;
  const foundation = new StorefrontFoundationService({ repository: storefrontRepository, approvalRepository, auditRepository, now: clock, idGenerator: idGenerator() });
  const planning = new StorefrontPlanningService({ storefrontRepository, productDraftRepository, approvalRepository, auditRepository, now: clock, idGenerator: idGenerator() });
  const themeMapping = new ThemeMappingService({ storefrontRepository, approvalRepository, auditRepository, now: clock, idGenerator: idGenerator() });
  const artifactPreview = new ArtifactPreviewService({ storefrontRepository, approvalRepository, auditRepository, now: clock, idGenerator: idGenerator() });
  const profile = await foundation.createProfile({
    brandName: "Lumora Beauty",
    brandPositioning: "Premium skincare inspired by nature.",
    targetMarkets: ["US"],
    defaultLocale: "en-US",
    currency: "USD",
    industry: "beauty",
  }, tenant);
  const project = await foundation.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-1"] }, tenant);
  const planned = await planning.planProject({ projectId: project.id, requestedBy: "merchant" }, tenant);
  await themeMapping.mapProject({ projectId: planned.id }, tenant);
  await artifactPreview.generatePreview({ projectId: planned.id }, tenant);
  return { storefrontRepository, approvalRepository, auditRepository, project: planned };
};

describe("SafeDeploymentService", () => {
  it("creates a deployment plan and completes a safe deployment as READY_FOR_RELEASE", async () => {
    const { storefrontRepository, approvalRepository, auditRepository, project } = await createPreviewReadyProject();
    const gateway = new FakeDeploymentGateway();
    const service = new SafeDeploymentService({
      storefrontRepository,
      approvalRepository,
      auditRepository,
      deploymentGateway: gateway,
      now: () => now,
      idGenerator: idGenerator(),
    });

    const plan = await service.createDeploymentPlan({ projectId: project.id, requestedBy: "merchant" }, tenant);
    const result = await service.deploy({ projectId: project.id, requestedBy: "merchant" }, tenant);

    expect(plan.compatibility.status).toBe("PASSED");
    expect(result.project.status).toBe("READY_FOR_RELEASE");
    expect(result.deployment.status).toBe("READY_FOR_RELEASE");
    expect(result.health.readyForRelease).toBe(true);
    expect(result.rollback.previousThemeReference).toBe("fake-active-theme");
    expect(gateway.uploadCount).toBe(1);
    expect(result.artifacts.map((artifact) => artifact.path)).toEqual(expect.arrayContaining([
      "theme-preview/bundle.json",
      "theme-deployment/deployment.json",
      "theme-deployment/health.json",
      "theme-deployment/rollback-preparation.json",
    ]));
    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toEqual(expect.arrayContaining([
      "DEPLOYMENT_PLAN_CREATED",
      "DEPLOYMENT_VALIDATED",
      "DEPLOYMENT_STARTED",
      "DEPLOYMENT_COMPLETED",
      "ROLLBACK_PREPARED",
    ]));
  });

  it("returns release readiness from persisted safe deployment artifacts", async () => {
    const { storefrontRepository, approvalRepository, auditRepository, project } = await createPreviewReadyProject();
    const service = new SafeDeploymentService({
      storefrontRepository,
      approvalRepository,
      auditRepository,
      now: () => now,
      idGenerator: idGenerator(),
    });
    await service.deploy({ projectId: project.id }, tenant);
    const updatedProject = await storefrontRepository.findProjectById(project.id);
    const artifacts = await storefrontRepository.listArtifacts(project.id);

    const readiness = service.verify({ project: updatedProject!, artifacts });

    expect(readiness).toMatchObject({
      ok: true,
      compatibilityPassed: true,
      validationPassed: true,
    });
    expect(readiness.targetThemeId).toBe(`noop-draft-theme:${project.id}`);
  });

  it("blocks deployment when preview artifacts are missing and records failure", async () => {
    const storefrontRepository = new InMemoryStorefrontRepository();
    const approvalRepository = new InMemoryApprovalRepository([]);
    const auditRepository = new InMemoryAuditRepository();
    const foundation = new StorefrontFoundationService({
      repository: storefrontRepository,
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
    }, tenant);
    const project = await foundation.createProject({ profileId: profile.id }, tenant);
    const service = new SafeDeploymentService({
      storefrontRepository,
      approvalRepository,
      auditRepository,
      now: () => now,
      idGenerator: idGenerator(),
    });

    await expect(service.deploy({ projectId: project.id }, tenant)).rejects.toMatchObject({
      code: "STOREFRONT_ARTIFACT_BUNDLE_REQUIRED",
    });
  });
});
