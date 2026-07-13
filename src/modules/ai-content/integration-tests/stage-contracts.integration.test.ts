import { describe, expect, it } from "vitest";
import {
  ProductContentToSEOInputMapper,
  SEOContentToSocialInputMapper,
  SocialContentToVideoInputMapper,
  VideoContentToEmailInputMapper,
  EmailContentToBlogInputMapper,
} from "../index.js";
import { buildOrchestrationInput } from "./builders/orchestration-input.builder.js";
import { createAIContentIntegrationHarness } from "./harness/ai-content-integration.harness.js";

describe("AI Content stage contract integration", () => {
  const result = createAIContentIntegrationHarness().orchestrate(buildOrchestrationInput(), {
    selectedSocialPlatforms: ["instagram", "facebook"],
    selectedVideoConfigurations: [{ platform: "instagram-reels", format: "short-form" }],
    selectedEmailCampaignTypes: ["educational-nurture"],
    selectedBlogArticleTypes: ["educational-article"],
    minimumApprovalScore: 0,
    minimumPublicationScore: 0,
    maximumWarnings: 100,
    maximumCriticalIssues: 100,
  });

  it("preserves Product-to-SEO identity, metadata and safe SEO output", () => {
    const product = result.productContentPackage!;
    const seo = result.seoContentPackage!;
    const mapped = new ProductContentToSEOInputMapper().map(product);

    expect(mapped.productId).toBe(product.productId);
    expect(mapped.benefits).toEqual(product.benefits.map((item) => item.snapshot().body));
    expect(mapped.features).toEqual(product.features.map((item) => item.snapshot().body));
    expect(seo.keywords.primaryKeyword.value).toBeTruthy();
    expect(seo.metaTitle.value.length).toBeGreaterThan(0);
    expect(seo.metaDescription.value.length).toBeGreaterThan(0);
    expect(seo.slug.value).toContain("lumora");
    expect(seo.h1).toBeTruthy();
    expect(seo.h2Headings.length).toBeGreaterThan(0);
    expect(seo.contentSEO.primaryKeyword?.value).toBe(seo.keywords.primaryKeyword.value);
  });

  it("keeps SEO-to-Social contracts platform-specific and commercially grounded", () => {
    const seo = result.seoContentPackage!;
    const mapped = new SEOContentToSocialInputMapper().map(seo);

    expect(mapped.productId).toBe(seo.productId);
    expect(result.socialContentPackages).toHaveLength(2);
    expect(
      new Set(result.socialContentPackages.map((item) => item.primaryCaption)).size,
    ).toBeGreaterThan(0);
    expect(result.socialContentPackages.every((item) => item.ctas.length > 0)).toBe(true);
    expect(result.socialContentPackages.every((item) => item.hashtags.length > 0)).toBe(true);
    expect(result.socialContentPackages.map((item) => item.platform)).toEqual([
      "instagram",
      "facebook",
    ]);
    expect(result.socialContentPackages.map((item) => item.objective)).toEqual([
      "conversion",
      "conversion",
    ]);
    const text = result.socialContentPackages
      .map((item) => item.primaryCaption)
      .join(" ")
      .toLowerCase();
    expect(text).not.toContain("trending now");
  });

  it("propagates Social-to-Video and Video-to-Email package contracts", () => {
    const social = result.socialContentPackages[0]!;
    const video = result.videoScriptPackages[0]!;
    const email = result.emailContentPackages[0]!;

    expect(new SocialContentToVideoInputMapper().map(social).socialMediaContentPackage).toBe(
      social,
    );
    expect(video.platform).toBe("instagram-reels");
    expect(video.targetDurationSeconds).toBe(30);
    expect(video.scenes.at(-1)?.timing.endSecond).toBe(video.targetDurationSeconds);
    expect(video.voiceoverScript.length).toBeGreaterThan(0);
    expect(video.onScreenText.length).toBeGreaterThan(0);
    expect(new VideoContentToEmailInputMapper().map(video).videoScriptPackage).toBe(video);
    expect(email.subjectLines.length).toBeGreaterThan(0);
    expect(email.preheaders.length).toBeGreaterThan(0);
    expect(email.sequence).toHaveLength(3);
    expect(email.plainTextVersion).toBeTruthy();
    expect(email.complianceNotes.length).toBeGreaterThan(0);
  });

  it("propagates Email-to-Blog while preserving editorial evidence boundaries", () => {
    const email = result.emailContentPackages[0]!;
    const blog = result.blogContentPackages[0]!;

    expect(new EmailContentToBlogInputMapper().map(email).emailContentPackage).toBe(email);
    expect(blog.recommendedTitle.length).toBeGreaterThan(0);
    expect(blog.outline.length).toBeGreaterThan(0);
    expect(blog.sections.length).toBeGreaterThan(0);
    expect(blog.faqSection.length).toBeGreaterThan(0);
    expect(blog.readingMetrics.estimatedWordCount).toBeGreaterThan(0);
    expect(blog.internalLinkAnchorSuggestions.length).toBeGreaterThan(0);
    expect(blog.externalSourcePlaceholderGuidance.length).toBeGreaterThan(0);
    expect(
      blog.sections
        .flatMap((section) => section.paragraphs)
        .join(" ")
        .toLowerCase(),
    ).not.toContain("study proves");
  });
});
