import { describe, expect, it } from "vitest";
import type { SupportedLocale } from "../index.js";
import { buildOrchestrationInput } from "./builders/orchestration-input.builder.js";
import { localeFixtures } from "./fixtures/marketing.fixtures.js";
import { createAIContentIntegrationHarness } from "./harness/ai-content-integration.harness.js";

describe("AI Content quality and localization integration", () => {
  it("scores every package with content-appropriate profiles and bounded scores", () => {
    const result = createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
      selectedSocialPlatforms: ["instagram"],
      selectedVideoConfigurations: [{ platform: "youtube", format: "educational" }],
      selectedEmailCampaignTypes: ["educational-nurture"],
      selectedBlogArticleTypes: ["educational-article"],
      minimumApprovalScore: 0,
      minimumPublicationScore: 0,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    });

    expect(result.qualityScorecards.map((item) => item.scoringProfile)).toEqual([
      "conversion-focused",
      "seo-focused",
      "social-engagement-focused",
      "video-performance-readiness",
      "email-conversion-focused",
      "editorial-quality-focused",
    ]);
    expect(
      result.qualityScorecards.every((item) => item.overallScore >= 0 && item.overallScore <= 100),
    ).toBe(true);
    expect(
      result.qualityScorecards.every(
        (item) => item.scoringVersion === "SACP Content Quality Rule Engine v1",
      ),
    ).toBe(true);
  });

  it("blocks localization after strict gate failure and permits advisory output", () => {
    const strict = createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
      localizeApprovedContent: true,
      targetLocales: ["ms-MY"],
      minimumApprovalScore: 100,
      minimumPublicationScore: 100,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    });
    expect(strict.qualityGate.status).toBe("failed");
    expect(strict.localizedContentPackages).toHaveLength(0);
    expect(strict.stageResults.find((stage) => stage.stageId === "localization")?.status).toBe(
      "blocked",
    );
    expect(strict.publicationReady).toBe(false);

    const advisory = createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
      localizeApprovedContent: true,
      targetLocales: ["ms-MY"],
      qualityGatePolicy: "advisory",
      strictQualityMode: false,
      minimumApprovalScore: 100,
      minimumPublicationScore: 100,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    });
    expect(advisory.qualityGate.status).toBe("passed-with-warnings");
    expect(advisory.localizedContentPackages.length).toBeGreaterThan(0);
  });

  it("supports English-to-Malay and English regional adaptation without source mutation", () => {
    const targets = localeFixtures.filter((locale) => locale !== "en-US");
    const input = buildOrchestrationInput();
    const result = productOnlyLocalization(input, targets);

    expect(new Set(result.localizedContentPackages.map((item) => item.targetLocale))).toEqual(
      new Set(targets),
    );
    expect(
      result.localizedContentPackages.every(
        (item) => item.sourceMetadata.sourceContentId !== undefined,
      ),
    ).toBe(true);
    expect(
      result.localizedContentPackages.every(
        (item) => item.localizationVersion === "SACP Content Localization Rule Engine v1",
      ),
    ).toBe(true);
    expect(
      result.localizedContentPackages.every((item) => item.validationResult.placeholdersPreserved),
    ).toBe(true);
    expect(result.contents.some((content) => content.snapshot().language === "en")).toBe(true);
    expect(result.contents.some((content) => content.snapshot().language === "ms")).toBe(true);
  });

  it("supports Malay-to-English localization", () => {
    const input = buildOrchestrationInput({
      sourceLanguage: "ms",
      sourceLocale: "ms-MY",
      targetLocales: ["en-US"],
    });
    const result = createAIContentIntegrationHarness().orchestrate(input, {
      generateSEOContent: false,
      generateSocialContent: false,
      generateVideoContent: false,
      generateEmailContent: false,
      generateBlogContent: false,
      scoreGeneratedContent: false,
      applyQualityGate: false,
      localizeApprovedContent: true,
      targetLocales: ["en-US"],
    });
    expect(result.productContentPackage?.language).toBe("ms");
    expect(result.localizedContentPackages.every((item) => item.targetLanguage === "en")).toBe(
      true,
    );
  });
});

function productOnlyLocalization(
  input: ReturnType<typeof buildOrchestrationInput>,
  targets: readonly SupportedLocale[],
) {
  return createAIContentIntegrationHarness().orchestrate(input, {
    generateSEOContent: false,
    generateSocialContent: false,
    generateVideoContent: false,
    generateEmailContent: false,
    generateBlogContent: false,
    scoreGeneratedContent: false,
    applyQualityGate: false,
    localizeApprovedContent: true,
    targetLocales: targets,
  });
}
