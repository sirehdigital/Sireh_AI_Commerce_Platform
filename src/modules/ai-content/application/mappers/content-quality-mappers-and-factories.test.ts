import { describe, expect, it } from "vitest";
import { Content, CTA, Headline } from "../../domain/index.js";
import {
  ContentQualityScoringInputFactory,
  ContentQualityScoringOptionsFactory,
  ContentScoringProfileFactory,
} from "../factories/index.js";
import {
  ContentAggregateToScoringInputMapper,
  ContentQualityScorecardMapper,
  ContentScoreToDomainMapper,
} from "./index.js";
import { DeterministicContentQualityScoringEngine } from "../../infrastructure/scoring/index.js";

describe("Content quality factories and mappers", () => {
  it("normalizes input without source mutation", () => {
    const source = {
      contentId: " content-1 ",
      contentType: "generic-content" as const,
      channel: "generic" as const,
      language: "en" as const,
      tone: "neutral" as const,
      headline: " Headline ",
      body: " Body copy ",
      structuredContent: { a: "A" },
      sourceMetadata: { productId: "prod-1" },
      campaignMetadata: {},
      correlationMetadata: {},
    };
    const normalized = new ContentQualityScoringInputFactory().create(source);

    expect(normalized.contentId).toBe("content-1");
    expect(normalized.headline).toBe("Headline");
    expect(source.contentId).toBe(" content-1 ");
  });

  it("applies option defaults and validates profile weights", () => {
    const options = new ContentQualityScoringOptionsFactory().create();
    const weights = new ContentScoringProfileFactory().create("seo-focused");

    expect(options.scoringProfile).toBe("balanced");
    expect(options.strictSafetyMode).toBe(true);
    expect(weights.seoQuality).toBeGreaterThan(weights.ctaQuality);
  });

  it("maps aggregate content to scoring input", () => {
    const content = Content.create({
      id: "content-map-1",
      type: "generic-content",
      channel: "generic",
      language: "en",
      tone: "neutral",
      headline: Headline.create("Generic content headline"),
      body: "Generic content body with a clear action. Learn more.",
      cta: CTA.create("Learn more"),
      metadata: { sourceProductId: "prod-1", campaignId: "campaign-1", correlationId: "corr-1" },
    });
    const input = new ContentAggregateToScoringInputMapper().map(content);

    expect(input.contentId).toBe("content-map-1");
    expect(input.cta?.value).toBe("Learn more");
    expect(input.campaignMetadata.campaignId).toBe("campaign-1");
  });

  it("maps scorecards to snapshots and domain scores", () => {
    const input = {
      contentId: "score-map-1",
      contentType: "generic-content" as const,
      channel: "generic" as const,
      language: "en" as const,
      tone: "neutral" as const,
      headline: "Generic content headline",
      body: "Generic content body with benefit clarity and a clear next step. Learn more.",
      structuredContent: {},
      sourceMetadata: { productId: "prod-1" },
      campaignMetadata: {},
      correlationMetadata: {},
    };
    const options = new ContentQualityScoringOptionsFactory().create();
    const scorecard = new DeterministicContentQualityScoringEngine().score(input, options);
    const snapshot = new ContentQualityScorecardMapper().toSnapshot(scorecard);
    const domainScore = new ContentScoreToDomainMapper().map(scorecard);

    expect(snapshot.contentId).toBe("score-map-1");
    expect(snapshot.overallScore).toBe(scorecard.overallScore);
    expect(domainScore.overallQuality.value).toBe(scorecard.overallScore);
  });
});
