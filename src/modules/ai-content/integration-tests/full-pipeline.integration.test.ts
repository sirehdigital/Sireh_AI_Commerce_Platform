import { describe, expect, it } from "vitest";
import {
  expectTraceablePortfolio,
  expectValidContentAggregates,
  deepFreeze,
} from "./assertions/content-integration.assertions.js";
import { buildOrchestrationInput } from "./builders/orchestration-input.builder.js";
import { createAIContentIntegrationHarness } from "./harness/ai-content-integration.harness.js";

describe("AI Content full pipeline integration", () => {
  it("coordinates every deterministic engine into a traceable localized portfolio", () => {
    const input = deepFreeze(buildOrchestrationInput());
    const before = JSON.stringify(input);
    const result = createAIContentIntegrationHarness().orchestrate(input, {
      selectedSocialPlatforms: ["instagram", "facebook", "tiktok"],
      selectedVideoConfigurations: [
        { platform: "instagram-reels", format: "short-form" },
        { platform: "youtube", format: "product-demonstration" },
      ],
      selectedEmailCampaignTypes: ["promotional", "product-launch"],
      selectedBlogArticleTypes: ["product-guide", "educational-article"],
      localizeApprovedContent: true,
      targetLocales: ["ms-MY"],
      minimumApprovalScore: 0,
      minimumPublicationScore: 0,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    });

    expect(result.productContentPackage).toBeDefined();
    expect(result.stageResults.find((stage) => stage.stageId === "seo-content")?.errors).toEqual(
      [],
    );
    expect(result.seoContentPackage).toBeDefined();
    expect(result.socialContentPackages.map((item) => item.platform)).toEqual([
      "instagram",
      "facebook",
      "tiktok",
    ]);
    expect(result.videoScriptPackages.map((item) => item.platform)).toEqual([
      "instagram-reels",
      "youtube",
    ]);
    expect(result.emailContentPackages.map((item) => item.campaignType)).toEqual([
      "promotional",
      "product-launch",
    ]);
    expect(result.blogContentPackages.map((item) => item.articleType)).toEqual([
      "product-guide",
      "educational-article",
    ]);
    expect(result.qualityScorecards).toHaveLength(11);
    expect(result.localizedContentPackages.length).toBeGreaterThan(0);
    expect(result.localizedContentPackages.every((item) => item.targetLocale === "ms-MY")).toBe(
      true,
    );
    expect(result.stageResults.map((stage) => stage.stageId)).toEqual([
      "input-validation",
      "product-content",
      "seo-content",
      "social-content",
      "video-content",
      "email-content",
      "blog-content",
      "quality-scoring",
      "quality-gate",
      "localization",
      "portfolio-assembly",
    ]);
    expectTraceablePortfolio(result);
    expectValidContentAggregates(result.contents);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("produces equivalent deterministic output and decisions for repeated execution", () => {
    const harness = createAIContentIntegrationHarness();
    const options = {
      selectedSocialPlatforms: ["instagram", "linkedin"],
      selectedVideoConfigurations: [{ platform: "youtube", format: "educational" }],
      selectedEmailCampaignTypes: ["educational-nurture"],
      selectedBlogArticleTypes: ["educational-article"],
      minimumApprovalScore: 0,
      minimumPublicationScore: 0,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    } as const;
    const first = harness.orchestrate(buildOrchestrationInput(), options);
    const second = harness.orchestrate(buildOrchestrationInput(), options);

    expect(snapshot(first)).toEqual(snapshot(second));
  });
});

function snapshot(
  result: ReturnType<ReturnType<typeof createAIContentIntegrationHarness>["orchestrate"]>,
): unknown {
  return {
    stages: result.stageResults.map((stage) => [stage.stageId, stage.status]),
    social: result.socialContentPackages.map((item) => item.primaryCaption),
    video: result.videoScriptPackages.map((item) => item.voiceoverScript),
    email: result.emailContentPackages.map((item) => item.mainBody),
    blog: result.blogContentPackages.map((item) =>
      item.sections.map((section) => section.paragraphs),
    ),
    scores: result.qualityScorecards.map((item) => item.overallScore),
    gate: result.qualityGate,
    readiness: result.readiness,
    audit: result.auditTrail.map((item) => [item.stageId, item.status, item.correlationId]),
  };
}
