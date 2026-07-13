import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expectTraceablePortfolio,
  expectValidContentAggregates,
} from "./assertions/content-integration.assertions.js";
import { buildOrchestrationInput } from "./builders/orchestration-input.builder.js";
import { createAIContentIntegrationHarness } from "./harness/ai-content-integration.harness.js";

describe("Shopify-oriented AI Content portfolio integration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds a quality-gated English and Malay draft portfolio without API calls or credentials", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network access is prohibited in integration tests."));
    const result = createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
      generateSocialContent: false,
      generateVideoContent: false,
      generateEmailContent: false,
      generateBlogContent: false,
      localizeApprovedContent: true,
      targetLocales: ["ms-MY"],
      minimumApprovalScore: 0,
      minimumPublicationScore: 0,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    });

    const product = result.productContentPackage!;
    const seo = result.seoContentPackage!;
    expect(product.channel).toBe("shopify");
    expect(product.shopifyReady.title).toContain("Lumora");
    expect(product.shopifyReady.descriptionHtml).toContain("<p>");
    expect(product.shopifyReady.benefits.length).toBeGreaterThan(0);
    expect(product.shopifyReady.features.length).toBeGreaterThan(0);
    expect(product.shopifyReady.callsToAction.length).toBeGreaterThan(0);
    expect(seo.metaTitle.value).toBeTruthy();
    expect(seo.metaDescription.value).toBeTruthy();
    expect(seo.slug.value).toBeTruthy();
    expect(result.contents.some((content) => content.snapshot().language === "en")).toBe(true);
    expect(result.contents.some((content) => content.snapshot().language === "ms")).toBe(true);
    expect(result.qualityGate.status).not.toBe("failed");
    expect(result.contents.every((content) => content.snapshot().status !== "published")).toBe(
      true,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expectTraceablePortfolio(result);
    expectValidContentAggregates(result.contents);
  });

  it("keeps aggregate growth bounded and avoids duplicate identities", () => {
    const result = createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
      selectedSocialPlatforms: ["instagram", "facebook"],
      selectedVideoConfigurations: [{ platform: "instagram-reels", format: "short-form" }],
      selectedEmailCampaignTypes: ["promotional"],
      selectedBlogArticleTypes: ["product-guide"],
      minimumApprovalScore: 0,
      minimumPublicationScore: 0,
      maximumWarnings: 100,
      maximumCriticalIssues: 100,
    });
    expect(result.contents.length).toBeLessThan(250);
    expect(new Set(result.contents.map((content) => content.id)).size).toBe(result.contents.length);
  });
});
