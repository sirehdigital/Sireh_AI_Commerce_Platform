import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { InMemoryProductDraftRepository } from "../../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import type { ShopifyThemeGateway, ShopifyThemeGatewayResult } from "../gateways/index.js";
import { InMemoryStorefrontRepository } from "../../infrastructure/index.js";
import type { StorefrontArtifact, StorefrontProject } from "../../domain/index.js";
import { ArtifactPreviewService } from "./artifact-preview.service.js";
import { ProductionLaunchService, type ProductionDeploymentVerifier } from "./production-launch.service.js";
import { StorefrontFoundationService } from "./storefront-foundation.service.js";
import { StorefrontPlanningService } from "./storefront-planning.service.js";
import { ThemeMappingService } from "./theme-mapping.service.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T14:20:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `release-id-${(id += 1).toString().padStart(3, "0")}`;
};

const approvedDraft = (id: string, title: string): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: now.toISOString() },
  title,
  description: `${title} is approved for production launch tests.`,
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

class SuccessfulDeploymentVerifier implements ProductionDeploymentVerifier {
  public verify(input: { readonly project: StorefrontProject; readonly artifacts: readonly StorefrontArtifact[] }) {
    return {
      ok: input.artifacts.some((artifact) => artifact.path === "theme-preview/bundle.json"),
      deploymentReference: `deployment:${input.project.id}`,
      previousActiveThemeId: "theme-previous",
      targetThemeId: "theme-draft-validated",
      compatibilityPassed: true,
      validationPassed: true,
      warnings: [],
    };
  }
}

class SuccessfulActivationGateway implements ShopifyThemeGateway {
  public readonly id = "successful-activation-gateway";
  public activationCount = 0;

  public generateArtifacts(): Promise<ShopifyThemeGatewayResult> {
    return Promise.resolve({ ok: true, previewUrl: null, artifactReferences: [], warnings: [] });
  }

  public activateTheme(): Promise<ShopifyThemeGatewayResult> {
    this.activationCount += 1;
    return Promise.resolve({ ok: true, previewUrl: null, artifactReferences: ["theme-draft-validated"], warnings: [] });
  }

  public publishProducts(): Promise<ShopifyThemeGatewayResult> {
    return Promise.resolve({ ok: false, previewUrl: null, artifactReferences: [], warnings: [], failureCode: "NOT_USED" });
  }

  public uploadMedia(): Promise<ShopifyThemeGatewayResult> {
    return Promise.resolve({ ok: false, previewUrl: null, artifactReferences: [], warnings: [], failureCode: "NOT_USED" });
  }
}

const createReadyProject = async () => {
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
  const artifacts = new ArtifactPreviewService({
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
  }, tenant);
  const project = await foundation.createProject({ profileId: profile.id, selectedProductDraftIds: ["draft-1"] }, tenant);
  const planned = await planning.planProject({ projectId: project.id, requestedBy: "merchant" }, tenant);
  await themeMapping.mapProject({ projectId: planned.id }, tenant);
  await artifacts.generatePreview({ projectId: planned.id }, tenant);
  return { storefrontRepository, approvalRepository, auditRepository, project: planned };
};

describe("ProductionLaunchService", () => {
  it("activates a validated draft theme and registers release metadata", async () => {
    const { storefrontRepository, auditRepository, project } = await createReadyProject();
    const gateway = new SuccessfulActivationGateway();
    const service = new ProductionLaunchService({
      storefrontRepository,
      auditRepository,
      deploymentVerifier: new SuccessfulDeploymentVerifier(),
      shopifyThemeGateway: gateway,
      now: () => now,
      idGenerator: idGenerator(),
    });

    const result = await service.release({ projectId: project.id, releaseNotes: ["Launch Lumora storefront."], requestedBy: "merchant" }, tenant);

    expect(result.project.status).toBe("DEPLOYED");
    expect(result.release).toMatchObject({
      status: "ACTIVATED",
      activatedThemeId: "theme-draft-validated",
      previousActiveThemeId: "theme-previous",
      deploymentReference: `deployment:${project.id}`,
      artifactCount: 14,
    });
    expect(result.summary.health).toMatchObject({
      themeActive: true,
      deploymentCompleted: true,
      activationSuccess: true,
      storeCompatibility: true,
      noPartialActivation: true,
    });
    expect(gateway.activationCount).toBe(1);
    expect(await service.getRelease(project.id, tenant)).toMatchObject({ status: "ACTIVATED", releaseId: result.release.releaseId });
    await expect(service.getReleaseHistory(project.id, tenant)).resolves.toHaveLength(1);
    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toEqual(expect.arrayContaining([
      "PRODUCTION_RELEASE_STARTED",
      "THEME_ACTIVATED",
      "PRODUCTION_RELEASE_COMPLETED",
    ]));
  });

  it("executes rollback using the previous active theme reference", async () => {
    const { storefrontRepository, auditRepository, project } = await createReadyProject();
    const service = new ProductionLaunchService({
      storefrontRepository,
      auditRepository,
      deploymentVerifier: new SuccessfulDeploymentVerifier(),
      shopifyThemeGateway: new SuccessfulActivationGateway(),
      now: () => now,
      idGenerator: idGenerator(),
    });
    const release = await service.release({ projectId: project.id }, tenant);

    const rollback = await service.rollback({ projectId: project.id, releaseId: release.release.releaseId }, tenant);

    expect(rollback).toMatchObject({
      status: "EXECUTED",
      restoredThemeId: "theme-previous",
      replacedThemeId: "theme-draft-validated",
    });
    expect(auditRepository.list(tenant).map((record) => record.details.storefrontEventType)).toContain("ROLLBACK_EXECUTED");
  });

  it("refuses production release when deployment readiness is unavailable", async () => {
    const { storefrontRepository, project } = await createReadyProject();
    const service = new ProductionLaunchService({ storefrontRepository });

    await expect(service.release({ projectId: project.id }, tenant)).rejects.toMatchObject({
      code: "STOREFRONT_PRODUCTION_RELEASE_BLOCKED",
    });
  });
});
