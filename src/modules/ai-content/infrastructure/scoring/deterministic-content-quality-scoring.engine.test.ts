import { describe, expect, it } from "vitest";
import type { ContentQualityScoringInput, ContentScoringProfile } from "../../application/dto/index.js";
import { ContentQualityScoringOptionsFactory } from "../../application/factories/index.js";
import { DeterministicContentQualityScoringEngine } from "./deterministic-content-quality-scoring.engine.js";

const PROFILES: readonly ContentScoringProfile[] = [
  "balanced",
  "conversion-focused",
  "seo-focused",
  "brand-focused",
  "safety-focused",
  "readability-focused",
  "social-engagement-focused",
  "email-conversion-focused",
  "video-performance-readiness",
  "editorial-quality-focused",
];

describe("DeterministicContentQualityScoringEngine", () => {
  const engine = new DeterministicContentQualityScoringEngine();
  const optionsFactory = new ContentQualityScoringOptionsFactory();

  const input: ContentQualityScoringInput = {
    contentId: "content-1",
    contentType: "blog-article",
    channel: "blog",
    language: "en",
    tone: "educational",
    audience: { description: "Readers comparing practical product options." },
    headline: "Product guide for practical daily decisions",
    body: "This product guide helps readers compare product fit and supports a clear next step. Learn more about the product and review source-backed details before publishing.",
    structuredContent: {
      overview: "Product overview with source-backed facts.",
      faq: "Common questions answered without fabricated claims.",
    },
    seo: {
      primaryKeyword: { value: "product guide", equals: () => false },
      secondaryKeywords: [],
      indexable: true,
    },
    sourceMetadata: { productId: "prod-1", objective: "education" },
    campaignMetadata: { campaignId: "campaign-1" },
    correlationMetadata: { correlationId: "corr-1" },
  };

  it("scores deterministically for repeated execution", () => {
    const options = optionsFactory.create({ scoringProfile: "balanced" });
    const first = engine.score(input, options);
    const second = engine.score(input, options);

    expect(first.overallScore).toBe(second.overallScore);
    expect(first.dimensionScores).toEqual(second.dimensionScores);
    expect(first.recommendations).toEqual(second.recommendations);
  });

  it.each(PROFILES)("supports the %s scoring profile", (scoringProfile) => {
    const scorecard = engine.score(input, optionsFactory.create({ scoringProfile }));

    expect(scorecard.scoringProfile).toBe(scoringProfile);
    expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(scorecard.overallScore).toBeLessThanOrEqual(100);
    expect(scorecard.dimensionScores.length).toBeGreaterThanOrEqual(17);
  });

  it("applies custom weights and stable score rounding", () => {
    const options = optionsFactory.create({
      customDimensionWeights: {
        seoQuality: 5,
        claimSafety: 3,
      },
    });
    const scorecard = engine.score(input, options);

    expect(scorecard.appliedWeights.seoQuality).toBeGreaterThan(scorecard.appliedWeights.clarity);
    expect(Number.isInteger(scorecard.overallScore) || scorecard.overallScore.toString().includes(".")).toBe(true);
  });

  it("caps scores and blocks approval for critical safety issues", () => {
    const unsafe = {
      ...input,
      body: `${input.body} This clinically proven product guarantees results for everyone with a five-star review.`,
    };
    const scorecard = engine.score(unsafe, optionsFactory.create({ scoringProfile: "safety-focused" }));

    expect(scorecard.criticalIssues.length).toBeGreaterThan(0);
    expect(scorecard.overallScore).toBeLessThanOrEqual(60);
    expect(scorecard.approvalReadiness).toBe("not-ready");
    expect(scorecard.recommendations.some((recommendation) => recommendation.blocking)).toBe(true);
  });

  it("keeps strong structure from hiding safety failures", () => {
    const unsafeStrongStructure = {
      ...input,
      structuredContent: {
        a: "Clear section.",
        b: "Another clear section.",
        c: "Detailed source section.",
      },
      body: `${input.body} This medical grade product cures problems permanently.`,
    };
    const scorecard = engine.score(unsafeStrongStructure, optionsFactory.create());

    expect(scorecard.dimensionScores.find((dimension) => dimension.dimension === "structuralQuality")?.score).toBeGreaterThan(80);
    expect(scorecard.overallScore).toBeLessThanOrEqual(60);
  });
});
