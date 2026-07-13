import { describe, expect, it } from "vitest";
import type { NormalizedProduct } from "../../../ai-product/types/product.types.js";
import type { AIContentOrchestrationInput } from "../dto/ai-content-orchestration.types.js";
import {
  InvalidAIContentOrchestrationOptionsError,
  MissingAIContentDependencyError,
} from "../errors/index.js";
import { AIContentExecutionPlanFactory } from "./ai-content-execution-plan.factory.js";
import { AIContentOrchestrationOptionsFactory } from "./ai-content-orchestration-options.factory.js";

describe("AI Content orchestration factories", () => {
  const optionsFactory = new AIContentOrchestrationOptionsFactory();
  const planFactory = new AIContentExecutionPlanFactory();

  it("creates the canonical full sequential plan with safe defaults", () => {
    const options = optionsFactory.create(buildInput());
    const plan = planFactory.create(options);

    expect(plan.stages.map((stage) => stage.id)).toEqual([
      "input-validation",
      "product-content",
      "seo-content",
      "social-content",
      "video-content",
      "email-content",
      "blog-content",
      "quality-scoring",
      "quality-gate",
      "portfolio-assembly",
    ]);
    expect(plan.failurePolicy).toBe("partial-success");
    expect(plan.qualityGatePolicy).toBe("strict");
    expect(plan.stages.find((stage) => stage.id === "social-content")?.parallelizable).toBe(true);
  });

  it("supports selected product-only and localization plans", () => {
    const options = optionsFactory.create(buildInput(), {
      generateSEOContent: false,
      generateSocialContent: false,
      generateVideoContent: false,
      generateEmailContent: false,
      generateBlogContent: false,
      scoreGeneratedContent: false,
      applyQualityGate: false,
      localizeApprovedContent: true,
      targetLocales: ["ms-MY", "en-GB", "ms-MY"],
    });
    const plan = planFactory.create(options);

    expect(plan.stages.map((stage) => stage.id)).toEqual([
      "input-validation",
      "product-content",
      "localization",
      "portfolio-assembly",
    ]);
    expect(plan.localizationTargets).toEqual(["ms-MY", "en-GB"]);
  });

  it("rejects contradictory failure policies and invalid thresholds", () => {
    expect(() =>
      optionsFactory.create(buildInput(), { failFastMode: true, partialSuccessMode: true }),
    ).toThrow(InvalidAIContentOrchestrationOptionsError);
    expect(() =>
      optionsFactory.create(buildInput(), {
        minimumApprovalScore: 90,
        minimumPublicationScore: 80,
      }),
    ).toThrow(InvalidAIContentOrchestrationOptionsError);
  });

  it("rejects a disabled required dependency", () => {
    const options = optionsFactory.create(buildInput(), {
      generateProductContent: false,
      generateSEOContent: true,
    });
    expect(() => planFactory.create(options)).toThrow(MissingAIContentDependencyError);
  });
});

export function buildInput(): AIContentOrchestrationInput {
  return {
    product: { product: buildProduct() },
    correlationId: "correlation-orchestrator-001",
    campaignId: "campaign-001",
    sourceLanguage: "en",
    sourceLocale: "en-US",
    targetLocales: ["ms-MY"],
    blogOptions: { strictEditorialEvidenceMode: false },
  };
}

function buildProduct(): NormalizedProduct {
  return {
    id: "product-orchestrator-001",
    source: "manual",
    status: "draft",
    title: "Lumora Daily Cleansing Brush",
    description: "A silicone brush designed for daily cleansing routines.",
    brand: "Lumora",
    category: "Beauty Care",
    productType: "Cleansing Brush",
    tags: ["beauty", "skincare"],
    targetMarkets: ["US", "MY"],
    images: [],
    options: [{ name: "Color", values: ["Rose", "White"] }],
    variants: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
