import { describe, expect, it, vi } from "vitest";

import { InMemoryProductDraftRepository } from "../../../product-draft/infrastructure/repositories/in-memory-product-draft.repository.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { DEFAULT_TENANT_CONTEXT } from "../../../saie/application/index.js";
import { FakeProductMediaGenerationProvider } from "../../infrastructure/providers/index.js";
import { InMemoryProductMediaRepository } from "../../infrastructure/repositories/index.js";
import { ProductMediaPlannerService } from "./product-media-planner.service.js";
import { ProductMediaSafetyValidator } from "./product-media-safety-validator.service.js";
import { ProductMediaOrchestratorService } from "./product-media-orchestrator.service.js";

const now = "2026-07-22T11:30:00.000Z";

const createIdGenerator = () => {
  let nextId = 0;
  return () => `id-${(nextId += 1)}`;
};

const buildDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  id: "draft-media-1",
  status: "draft",
  version: 1,
  source: {
    sourceType: "import",
    sourceId: "generic:media-1",
    supplierProductId: "media-1",
    importedAt: now,
  },
  title: "Lumora Botanical Glow Lotion",
  description: "A botanical body lotion with shea ingredient detail. Apply daily after shower to hydrate, soften, and support a natural glow.",
  productType: "Body Care",
  tags: ["beauty", "botanical", "hydrate", "ingredient:shea", "apply daily"],
  targetMarkets: ["US"],
  images: [
    {
      id: "source-1",
      sourceUrl: "https://images.test/lumora-lotion.jpg",
      altText: "Lumora lotion bottle",
      position: 1,
      width: 2048,
      height: 2048,
      selected: true,
      primary: true,
    },
  ],
  variants: [
    {
      id: "variant-1",
      title: "Default Title",
      sku: "LUMORA-LOTION",
      options: [{ name: "Title", value: "Default Title" }],
      supplierPrice: { amount: 8, currency: "USD" },
      sellingPrice: { amount: 24, currency: "USD" },
      inventoryQuantity: 20,
      available: true,
    },
  ],
  branding: {
    brandName: "Lumora Beauty",
    productName: "Botanical Glow Lotion",
    collectionName: "Body Lotion",
    positioning: "Beauty & Nature",
    targetAudience: ["premium skincare shoppers"],
    valueProposition: "soft, calm, hydrated skin feel",
  },
  riskAssessment: {
    level: "low",
    reasons: [],
    restrictedClaims: [],
    assessedAt: now,
  },
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const lumoraProfile = {
  brandName: "Lumora Beauty",
  visualIdentity: ["cream", "beige", "soft gold", "olive green", "white"],
  preferredColorPalette: ["cream", "beige", "soft gold", "olive green", "white"],
  mood: ["calm", "elegant", "trustworthy", "premium", "natural"],
  lightingDirection: "soft natural beauty lighting",
  backgroundPreferences: ["cream studio", "natural botanical setting"],
  prohibitedStyles: ["clinical before-after", "loud neon", "third-party logos"],
  targetAudience: ["premium skincare shoppers"],
  locale: "en-US",
  channelPreferences: ["shopify-product", "storefront", "social"],
};

const createOrchestrator = async (input: {
  readonly provider?: FakeProductMediaGenerationProvider;
  readonly draft?: ProductDraft;
} = {}) => {
  const draftRepository = new InMemoryProductDraftRepository();
  await draftRepository.save(input.draft ?? buildDraft());
  const mediaRepository = new InMemoryProductMediaRepository();
  const approvalRepository = new InMemoryApprovalRepository([]);
  const auditRepository = new InMemoryAuditRepository();
  const orchestrator = new ProductMediaOrchestratorService({
    productDraftRepositoryFactory: () => draftRepository,
    productMediaRepository: mediaRepository,
    approvalRepository,
    auditRepository,
    ...(input.provider === undefined ? {} : { provider: input.provider }),
    idGenerator: createIdGenerator(),
    now: () => new Date(now),
  });
  return { orchestrator, mediaRepository, approvalRepository, auditRepository };
};

describe("ProductMediaPlannerService", () => {
  it("generates deterministic media plans for complete product draft data", () => {
    const planner = new ProductMediaPlannerService();
    const first = planner.createPlan({
      productDraft: buildDraft(),
      brandProfile: lumoraProfile,
      requestedAssetTypes: ["PRODUCT_HERO", "BENEFIT_CARD", "INGREDIENT_CARD", "HOW_TO_USE", "SOCIAL_VERTICAL"],
      channels: ["shopify-product", "social"],
      createdAt: now,
      idGenerator: createIdGenerator(),
    });
    const second = planner.createPlan({
      productDraft: buildDraft(),
      brandProfile: lumoraProfile,
      requestedAssetTypes: ["PRODUCT_HERO", "BENEFIT_CARD", "INGREDIENT_CARD", "HOW_TO_USE", "SOCIAL_VERTICAL"],
      channels: ["shopify-product", "social"],
      createdAt: now,
      idGenerator: createIdGenerator(),
    });

    expect(second).toEqual(first);
    expect(first.assets.map((asset) => asset.assetType)).toEqual([
      "PRODUCT_HERO",
      "BENEFIT_CARD",
      "INGREDIENT_CARD",
      "HOW_TO_USE",
      "SOCIAL_VERTICAL",
    ]);
    expect(first.assets.find((asset) => asset.assetType === "PRODUCT_HERO")?.specification).toMatchObject({
      width: 2048,
      height: 2048,
      aspectRatio: "1:1",
    });
    expect(first.assets.find((asset) => asset.assetType === "SOCIAL_VERTICAL")?.specification).toMatchObject({
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
    });
    expect(first.brandProfile.preferredColorPalette).toContain("soft gold");
    expect(first.qualityReport.visualQuality).toBe("UNKNOWN");
  });

  it("skips ingredient and how-to assets when verified data is missing", () => {
    const planner = new ProductMediaPlannerService();
    const plan = planner.createPlan({
      productDraft: buildDraft({ title: "Lumora Body Lotion", description: "A simple body lotion.", tags: ["beauty"] }),
      requestedAssetTypes: ["INGREDIENT_CARD", "HOW_TO_USE", "PRODUCT_HERO"],
      createdAt: now,
      idGenerator: createIdGenerator(),
    });

    expect(plan.assets.map((asset) => asset.assetType)).toEqual(["PRODUCT_HERO"]);
    expect(plan.warnings.join(" ")).toContain("Ingredient card skipped");
    expect(plan.warnings.join(" ")).toContain("How-to-use asset skipped");
  });

  it("creates anti-hallucination prompt constraints without inventing claims", () => {
    const plan = new ProductMediaPlannerService().createPlan({
      productDraft: buildDraft(),
      requestedAssetTypes: ["PRODUCT_HERO"],
      createdAt: now,
      idGenerator: createIdGenerator(),
    });
    const prompt = plan.assets[0]?.prompt;

    expect(prompt?.prompt).toContain("Lumora Botanical Glow Lotion");
    expect(prompt?.negativePrompt).toContain("do not invent medical claims");
    expect(prompt?.negativePrompt).toContain("do not invent certifications");
    expect(prompt?.negativePrompt).toContain("do not claim clinically proven unless verified");
  });
});

describe("ProductMediaSafetyValidator", () => {
  it("blocks medical claims and before-after imagery", () => {
    const plan = new ProductMediaPlannerService().createPlan({
      productDraft: buildDraft({ description: "Clinically proven before and after medical treatment." }),
      requestedAssetTypes: ["PRODUCT_HERO"],
      createdAt: now,
      idGenerator: createIdGenerator(),
    });
    const result = new ProductMediaSafetyValidator().validate(plan);

    expect(result.blockedReasons.join(" ")).toContain("Unsupported health or medical claim");
    expect(result.blockedReasons.join(" ")).toContain("Before/after imagery");
  });

  it("validates source media URLs, duplicates, resolution, and usage rights", () => {
    const plan = new ProductMediaPlannerService().createPlan({
      productDraft: buildDraft(),
      requestedAssetTypes: ["PRODUCT_HERO"],
      sourceMedia: [
        { sourceAssetId: "a", originalUrl: "https://images.test/a.jpg", width: 300, height: 300, licenseStatus: "unknown" },
        { sourceAssetId: "b", originalUrl: "https://images.test/a.jpg", licenseStatus: "verified" },
      ],
      createdAt: now,
      idGenerator: createIdGenerator(),
    });

    expect(plan.warnings.join(" ")).toContain("low resolution");
    expect(plan.warnings.join(" ")).toContain("unknown usage rights");
    expect(plan.warnings.join(" ")).toContain("duplicates another media URL");
  });
});

describe("ProductMediaOrchestratorService", () => {
  it("creates plan-only jobs without calling a generation provider", async () => {
    const provider = new FakeProductMediaGenerationProvider();
    const spy = vi.spyOn(provider, "generate");
    const { orchestrator, approvalRepository, auditRepository } = await createOrchestrator({ provider });

    const result = await orchestrator.execute({
      productDraftId: "draft-media-1",
      mode: "PLAN_ONLY",
      requestedAssetTypes: ["PRODUCT_HERO", "SOCIAL_SQUARE"],
      requestedBy: "merchant",
      brandProfile: lumoraProfile,
    }, DEFAULT_TENANT_CONTEXT);

    expect(spy).not.toHaveBeenCalled();
    expect(result.job.status).toBe("PENDING_REVIEW");
    expect(result.assets.every((asset) => asset.status === "PLANNED")).toBe(true);
    expect(approvalRepository.findById(DEFAULT_TENANT_CONTEXT, result.job.approvalId ?? "")).toMatchObject({
      status: "pending",
      requiresHumanApproval: true,
      executionEnabled: false,
    });
    expect(auditRepository.findById(DEFAULT_TENANT_CONTEXT, result.job.auditReference ?? "")).toMatchObject({
      entityId: result.job.id,
    });
  });

  it("generates with a configured fake provider and remains pending review", async () => {
    const { orchestrator } = await createOrchestrator({ provider: new FakeProductMediaGenerationProvider() });

    const result = await orchestrator.execute({
      productDraftId: "draft-media-1",
      mode: "GENERATE",
      providerId: "fake-product-media-provider",
      requestedAssetTypes: ["PRODUCT_HERO"],
      requestedBy: "merchant",
    }, DEFAULT_TENANT_CONTEXT);

    expect(result.job.status).toBe("PENDING_REVIEW");
    expect(result.assets[0]).toMatchObject({
      status: "GENERATED",
      providerId: "fake-product-media-provider",
    });
  });

  it("fails safely when generate is requested without a configured provider", async () => {
    const { orchestrator } = await createOrchestrator();

    const result = await orchestrator.execute({
      productDraftId: "draft-media-1",
      mode: "GENERATE",
      requestedAssetTypes: ["PRODUCT_HERO"],
      requestedBy: "merchant",
    }, DEFAULT_TENANT_CONTEXT);

    expect(result.job).toMatchObject({
      status: "FAILED",
      failureCode: "PRODUCT_MEDIA_PROVIDER_UNCONFIGURED",
    });
  });

  it("persists partial provider failure without auto-approval", async () => {
    const { orchestrator, approvalRepository } = await createOrchestrator({
      provider: new FakeProductMediaGenerationProvider(["SOCIAL_VERTICAL"]),
    });

    const result = await orchestrator.execute({
      productDraftId: "draft-media-1",
      mode: "GENERATE",
      providerId: "fake-product-media-provider",
      requestedAssetTypes: ["PRODUCT_HERO", "SOCIAL_VERTICAL"],
      requestedBy: "merchant",
    }, DEFAULT_TENANT_CONTEXT);

    expect(result.job.status).toBe("PARTIALLY_GENERATED");
    expect(result.assets.map((asset) => asset.status)).toContain("FAILED");
    expect(approvalRepository.findById(DEFAULT_TENANT_CONTEXT, result.job.approvalId ?? "")?.status).toBe("pending");
  });

  it("reuses equivalent media jobs and preserves forced regeneration history", async () => {
    const { orchestrator, mediaRepository } = await createOrchestrator();
    const request = {
      productDraftId: "draft-media-1",
      mode: "PLAN_ONLY" as const,
      requestedAssetTypes: ["PRODUCT_HERO"] as const,
      requestedBy: "merchant",
    };

    const first = await orchestrator.execute(request, DEFAULT_TENANT_CONTEXT);
    const replay = await orchestrator.execute(request, DEFAULT_TENANT_CONTEXT);
    const forced = await orchestrator.execute({ ...request, force: true }, DEFAULT_TENANT_CONTEXT);

    expect(replay.job.id).toBe(first.job.id);
    expect(forced.job.id).not.toBe(first.job.id);
    expect(forced.job.parentJobId).toBe(first.job.id);
    await expect(mediaRepository.listJobs()).resolves.toMatchObject({ total: 2 });
  });

  it("blocks cross-tenant draft access and unknown drafts", async () => {
    const { orchestrator } = await createOrchestrator();

    await expect(orchestrator.execute({
      productDraftId: "missing-draft",
      mode: "PLAN_ONLY",
      requestedBy: "merchant",
    }, DEFAULT_TENANT_CONTEXT)).rejects.toMatchObject({ code: "PRODUCT_MEDIA_DRAFT_NOT_FOUND" });
  });
});
