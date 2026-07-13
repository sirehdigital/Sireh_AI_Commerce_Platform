import { describe, expect, it } from "vitest";
import { Content, CTA, Headline, SEOKeyword } from "../../domain/index.js";
import { DeterministicContentQualityScoringEngine } from "../../infrastructure/scoring/index.js";
import {
  InvalidContentScoringWeightsError,
  MissingContentScoringSourceError,
  UnsupportedContentScoringProfileError,
} from "../errors/index.js";
import { ContentAggregateToScoringInputMapper } from "../mappers/index.js";
import { ScoreContentQualityUseCase } from "./score-content-quality.use-case.js";

describe("ScoreContentQualityUseCase", () => {
  const useCase = new ScoreContentQualityUseCase(new DeterministicContentQualityScoringEngine());

  it("scores content and maps to ContentScore", () => {
    const content = Content.create({
      id: "content-quality-1",
      type: "blog-article",
      channel: "blog",
      language: "en",
      tone: "educational",
      headline: Headline.create("Product guide for careful product evaluation"),
      body: "This product guide helps readers understand product benefits, compare practical fit and learn more from source-backed content.",
      structuredContent: { overview: "Source-backed product overview." },
      cta: CTA.create("Learn more"),
      seo: {
        primaryKeyword: SEOKeyword.create("product guide"),
        secondaryKeywords: [],
        indexable: true,
      },
      metadata: { sourceProductId: "prod-1", campaignId: "campaign-1", correlationId: "corr-1" },
    });
    const input = new ContentAggregateToScoringInputMapper().map(content);
    const scorecard = useCase.execute({ input, options: { assignScoreToContent: true } });

    expect(scorecard.contentScore.overallQuality.value).toBe(scorecard.overallScore);
    expect(scorecard.updatedContent?.snapshot().score?.overallQuality.value).toBe(scorecard.overallScore);
    expect(scorecard.evaluatedMetadata.campaignMetadata).toEqual({ campaignId: "campaign-1" });
  });

  it("returns readiness states based on thresholds", () => {
    const scorecard = useCase.execute({
      input: {
        contentId: "quality-ready-1",
        contentType: "product-description",
        channel: "shopify",
        language: "en",
        tone: "professional",
        headline: "Clear product description",
        body: "This product description helps customers understand the benefit, product fit, and a clear next step. View product details.",
        structuredContent: { benefits: "Benefit and feature details." },
        cta: CTA.create("View product details"),
        sourceMetadata: { productId: "prod-2" },
        campaignMetadata: {},
        correlationMetadata: {},
      },
      options: { minimumApprovalScore: 50, minimumPublishScore: 60 },
    });

    expect(["ready-for-review", "ready-for-approval", "ready-for-publication"]).toContain(scorecard.approvalReadiness);
  });

  it("rejects invalid scoring profile and weights", () => {
    const input = {
      contentId: "bad-options",
      contentType: "generic-content" as const,
      channel: "generic" as const,
      language: "en" as const,
      tone: "neutral" as const,
      headline: "Generic content",
      body: "Generic content body for scoring.",
      structuredContent: {},
      sourceMetadata: {},
      campaignMetadata: {},
      correlationMetadata: {},
    };

    expect(() => useCase.execute({ input, options: { scoringProfile: "bad" as "balanced" } })).toThrow(
      UnsupportedContentScoringProfileError,
    );
    expect(() => useCase.execute({ input, options: { customDimensionWeights: { claimSafety: -1 } } })).toThrow(
      InvalidContentScoringWeightsError,
    );
  });

  it("rejects missing scoring source", () => {
    expect(() =>
      useCase.execute({
        input: {
          contentId: " ",
          contentType: "generic-content",
          channel: "generic",
          language: "en",
          tone: "neutral",
          headline: "",
          body: "",
          structuredContent: {},
          sourceMetadata: {},
          campaignMetadata: {},
          correlationMetadata: {},
        },
      }),
    ).toThrow(MissingContentScoringSourceError);
  });
});
