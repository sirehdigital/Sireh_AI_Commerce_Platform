import { describe, expect, it } from "vitest";
import type { NormalizedProduct } from "../../../ai-product/types/product.types.js";
import type { AIContentOrchestrationInput } from "../dto/ai-content-orchestration.types.js";
import type { AIContentOrchestrationClock } from "../dto/ai-content-orchestration.types.js";
import { AIContentStageExecutionError } from "../errors/index.js";
import {
  DeterministicBlogContentGenerator,
  DeterministicEmailContentGenerator,
  DeterministicProductContentGenerator,
  DeterministicSEOContentGenerator,
  DeterministicSocialMediaContentGenerator,
  DeterministicVideoScriptGenerator,
} from "../../infrastructure/generators/index.js";
import { DeterministicContentLocalizationEngine } from "../../infrastructure/localization/index.js";
import { DeterministicContentQualityScoringEngine } from "../../infrastructure/scoring/index.js";
import { GenerateBlogContentUseCase } from "./generate-blog-content.use-case.js";
import { GenerateEmailContentUseCase } from "./generate-email-content.use-case.js";
import { GenerateProductContentUseCase } from "./generate-product-content.use-case.js";
import { GenerateSEOContentUseCase } from "./generate-seo-content.use-case.js";
import { GenerateSocialMediaContentUseCase } from "./generate-social-media-content.use-case.js";
import { GenerateVideoScriptUseCase } from "./generate-video-script.use-case.js";
import { LocalizeContentUseCase } from "./localize-content.use-case.js";
import { ScoreContentQualityUseCase } from "./score-content-quality.use-case.js";
import {
  OrchestrateAIContentUseCase,
  type AIContentOrchestratorDependencies,
} from "./orchestrate-ai-content.use-case.js";

class FixedClock implements AIContentOrchestrationClock {
  public now(): Date {
    return new Date("2026-07-13T00:00:00.000Z");
  }
}

describe("OrchestrateAIContentUseCase", () => {
  it("coordinates the complete deterministic content portfolio in stable stage order", () => {
    const input = buildInput();
    const before = JSON.stringify(input);
    const result = buildOrchestrator().orchestrate(input, {
      selectedSocialPlatforms: ["instagram", "facebook"],
      selectedVideoConfigurations: [
        { platform: "instagram-reels", format: "short-form" },
        { platform: "youtube", format: "product-demonstration" },
      ],
      selectedEmailCampaignTypes: ["promotional", "product-launch"],
      selectedBlogArticleTypes: ["product-guide", "educational-article"],
      minimumApprovalScore: 0,
      minimumPublicationScore: 0,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    });

    expect(result.productContentPackage?.productId).toBe("product-orchestrator-001");
    expect(result.seoContentPackage?.productId).toBe("product-orchestrator-001");
    expect(result.socialContentPackages).toHaveLength(2);
    expect(result.videoScriptPackages).toHaveLength(2);
    expect(result.emailContentPackages).toHaveLength(2);
    expect(result.blogContentPackages).toHaveLength(2);
    expect(result.qualityScorecards).toHaveLength(10);
    expect(result.contents.length).toBeGreaterThan(0);
    expect(result.correlationId).toBe("correlation-orchestrator-001");
    expect(result.auditTrail.map((record) => record.sequence)).toEqual(
      result.auditTrail.map((_, index) => index + 1),
    );
    expect(result.stageResults.at(-1)?.stageId).toBe("portfolio-assembly");
    expect(result.orchestratedAt.toISOString()).toBe("2026-07-13T00:00:00.000Z");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("runs product-only localization without changing source aggregates", () => {
    const result = buildOrchestrator().orchestrate(buildInput(), {
      generateSEOContent: false,
      generateSocialContent: false,
      generateVideoContent: false,
      generateEmailContent: false,
      generateBlogContent: false,
      scoreGeneratedContent: false,
      applyQualityGate: false,
      localizeApprovedContent: true,
      targetLocales: ["ms-MY"],
    });

    expect(result.localizedContentPackages.length).toBe(
      result.productContentPackage?.contents.length,
    );
    expect(result.localizedContentPackages.every((item) => item.targetLocale === "ms-MY")).toBe(
      true,
    );
    expect(
      result.localizedContentPackages.every(
        (item) => item.sourceMetadata.sourceContentId !== undefined,
      ),
    ).toBe(true);
    expect(result.contents.some((content) => content.snapshot().language === "en")).toBe(true);
    expect(result.contents.some((content) => content.snapshot().language === "ms")).toBe(true);
  });

  it("retains successful platform output and reports a later platform failure in partial-success mode", () => {
    const dependencies = buildDependencies();
    let socialCall = 0;
    const orchestrator = new OrchestrateAIContentUseCase(
      {
        ...dependencies,
        socialContent: {
          execute: (request) => {
            socialCall += 1;
            if (socialCall === 2) throw new Error("isolated platform failure");
            return dependencies.socialContent.execute(request);
          },
        },
      },
      undefined,
      undefined,
      undefined,
      undefined,
      new FixedClock(),
    );
    const result = orchestrator.orchestrate(buildInput(), {
      generateSEOContent: false,
      generateVideoContent: false,
      generateEmailContent: false,
      generateBlogContent: false,
      scoreGeneratedContent: false,
      applyQualityGate: false,
      selectedSocialPlatforms: ["instagram", "facebook"],
      partialSuccessMode: true,
      failFastMode: false,
    });

    expect(result.socialContentPackages).toHaveLength(1);
    expect(result.stageResults.find((stage) => stage.stageId === "social-content")?.status).toBe(
      "completed-with-warnings",
    );
    expect(result.errors.some((error) => error.message === "isolated platform failure")).toBe(true);
    expect(result.readiness).toBe("partial");
  });

  it("stops on the same isolated failure in fail-fast mode", () => {
    const dependencies = buildDependencies();
    const orchestrator = new OrchestrateAIContentUseCase(
      {
        ...dependencies,
        socialContent: {
          execute: () => {
            throw new Error("platform failure");
          },
        },
      },
      undefined,
      undefined,
      undefined,
      undefined,
      new FixedClock(),
    );

    expect(() =>
      orchestrator.orchestrate(buildInput(), {
        generateSEOContent: false,
        generateVideoContent: false,
        generateEmailContent: false,
        generateBlogContent: false,
        scoreGeneratedContent: false,
        applyQualityGate: false,
        failFastMode: true,
        partialSuccessMode: false,
      }),
    ).toThrow(AIContentStageExecutionError);
  });

  it("produces equivalent portfolio decisions for identical deterministic input", () => {
    const orchestrator = buildOrchestrator();
    const options = {
      generateSEOContent: false,
      generateSocialContent: false,
      generateVideoContent: false,
      generateEmailContent: false,
      generateBlogContent: false,
      scoreGeneratedContent: false,
      applyQualityGate: false,
    } as const;
    const first = orchestrator.orchestrate(buildInput(), options);
    const second = orchestrator.orchestrate(buildInput(), options);

    expect(first.stageResults.map((stage) => [stage.stageId, stage.status])).toEqual(
      second.stageResults.map((stage) => [stage.stageId, stage.status]),
    );
    expect(first.contents.map((content) => content.snapshot().body)).toEqual(
      second.contents.map((content) => content.snapshot().body),
    );
  });
});

function buildOrchestrator(): OrchestrateAIContentUseCase {
  return new OrchestrateAIContentUseCase(
    buildDependencies(),
    undefined,
    undefined,
    undefined,
    undefined,
    new FixedClock(),
  );
}

function buildDependencies(): AIContentOrchestratorDependencies {
  return {
    productContent: new GenerateProductContentUseCase(new DeterministicProductContentGenerator()),
    seoContent: new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator()),
    socialContent: new GenerateSocialMediaContentUseCase(
      new DeterministicSocialMediaContentGenerator(),
    ),
    videoContent: new GenerateVideoScriptUseCase(new DeterministicVideoScriptGenerator()),
    emailContent: new GenerateEmailContentUseCase(new DeterministicEmailContentGenerator()),
    blogContent: new GenerateBlogContentUseCase(new DeterministicBlogContentGenerator()),
    qualityScoring: new ScoreContentQualityUseCase(new DeterministicContentQualityScoringEngine()),
    localization: new LocalizeContentUseCase(new DeterministicContentLocalizationEngine()),
  };
}

function buildInput(): AIContentOrchestrationInput {
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
