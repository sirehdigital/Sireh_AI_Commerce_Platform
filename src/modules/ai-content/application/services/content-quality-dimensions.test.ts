import { describe, expect, it } from "vitest";
import type { ContentQualityDimension, ContentQualityScoringInput } from "../dto/index.js";
import { ContentQualityScoringOptionsFactory } from "../factories/index.js";
import { DeterministicContentQualityScoringEngine } from "../../infrastructure/scoring/index.js";

const DIMENSIONS: readonly ContentQualityDimension[] = [
  "clarity",
  "relevance",
  "persuasiveness",
  "readability",
  "seoQuality",
  "brandAlignment",
  "audienceAlignment",
  "channelSuitability",
  "structuralQuality",
  "ctaQuality",
  "claimSafety",
  "complianceReadiness",
  "toneConsistency",
  "languageConsistency",
  "factualGrounding",
  "originalityHeuristic",
  "actionability",
];

describe("Content quality dimensions", () => {
  const engine = new DeterministicContentQualityScoringEngine();
  const options = new ContentQualityScoringOptionsFactory().create();

  const input: ContentQualityScoringInput = {
    contentId: "dimension-1",
    contentType: "email-body",
    channel: "email",
    language: "en",
    tone: "friendly",
    audience: { description: "Email subscribers considering a product." },
    headline: "Helpful product update",
    body: "This product update helps customers understand benefits and product fit. Learn more.\n\nUnsubscribe: {{unsubscribe_url}}",
    structuredContent: {
      subject: "Helpful product update",
      preheader: "A simple product guide.",
    },
    sourceMetadata: { productId: "prod-1" },
    campaignMetadata: { objective: "conversion" },
    correlationMetadata: {},
  };

  it.each(DIMENSIONS)("returns a normalized %s score", (dimension) => {
    const scorecard = engine.score(input, options);
    const dimensionScore = scorecard.dimensionScores.find((item) => item.dimension === dimension);

    expect(dimensionScore).toBeDefined();
    expect(dimensionScore?.score).toBeGreaterThanOrEqual(0);
    expect(dimensionScore?.score).toBeLessThanOrEqual(100);
  });

  it("detects email compliance and personalization token issues", () => {
    const scorecard = engine.score(
      {
        ...input,
        body: "Hello {{unknown_token}}, this offer is useful.",
      },
      options,
    );

    expect(scorecard.failedChecks).toContain("email-unsubscribe");
    expect(scorecard.failedChecks).toContain("personalization-token");
  });

  it("detects SEO keyword stuffing", () => {
    const scorecard = engine.score(
      {
        ...input,
        contentType: "blog-article",
        channel: "blog",
        seo: {
          primaryKeyword: { value: "desk lamp", equals: () => false },
          secondaryKeywords: [],
          indexable: true,
        },
        body: "desk lamp desk lamp desk lamp desk lamp desk lamp helps compare product fit.",
      },
      options,
    );

    expect(scorecard.failedChecks).toContain("keyword-stuffing");
  });
});
