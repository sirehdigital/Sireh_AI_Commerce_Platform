import { describe, expect, it } from "vitest";
import { DeterministicBlogContentGenerator } from "../../infrastructure/generators/index.js";
import { UnsupportedBlogArticleTypeError, UnsafeBlogContentError } from "../errors/index.js";
import { GenerateBlogContentUseCase } from "./generate-blog-content.use-case.js";

describe("GenerateBlogContentUseCase", () => {
  const useCase = new GenerateBlogContentUseCase(new DeterministicBlogContentGenerator());

  const input = {
    productId: "prod-blog-1",
    productTitle: "Sireh Smart Bottle",
    brand: "Sireh",
    category: "hydration accessory",
    productDescription: "A reusable bottle for everyday hydration routines.",
    benefits: ["supports daily hydration planning", "helps compare reusable bottle fit"],
    features: ["reusable format", "portable size", "simple care instructions"],
    highlights: ["merchant-approved product overview"],
    productRisks: ["Care instructions should follow merchant documentation."],
    usageGuidance: ["Clean according to supplied product documentation."],
    targetAudience: {
      primaryAudience: "active consumers",
      description: "Consumers comparing practical hydration accessories.",
      objections: ["unclear care requirements"],
    },
    verifiedResearchFacts: [{ fact: "Merchant source confirms reusable bottle positioning." }],
    correlationMetadata: {
      campaignId: "campaign-1",
      correlationId: "corr-1",
      sourceMarketingAnalysisId: "marketing-1",
      customerJourneyReference: "consideration",
    },
  };

  it("generates a complete blog content package", () => {
    const output = useCase.execute({
      input,
      options: {
        articleType: "product-guide",
        objective: "education",
        channel: "blog",
        language: "en",
        tone: "educational",
      },
    });

    expect(output.articleType).toBe("product-guide");
    expect(output.objective).toBe("education");
    expect(output.language).toBe("en");
    expect(output.tone).toBe("educational");
    expect(output.channel).toBe("blog");
    expect(output.searchIntent).toBe("informational");
    expect(output.contents.length).toBeGreaterThanOrEqual(5);
    expect(output.contents[0]?.snapshot().status).toBe("draft");
    expect(output.sourceMetadata.campaignId).toBe("campaign-1");
  });

  it("maps article sections, FAQ, SEO and reading metrics", () => {
    const output = useCase.execute({ input, options: { articleType: "buying-guide", objective: "consideration" } });

    expect(output.sections.length).toBeGreaterThan(0);
    expect(output.faqSection.length).toBeGreaterThan(0);
    expect(output.primaryKeyword).toBe("hydration accessory");
    expect(output.metaDescription.length).toBeGreaterThan(10);
    expect(output.readingMetrics.estimatedReadingMinutes).toBeGreaterThan(0);
    expect(output.wordCount).toBe(output.readingMetrics.estimatedWordCount);
  });

  it("propagates unsupported article type errors", () => {
    expect(() =>
      useCase.execute({
        input,
        options: { articleType: "unsupported" as "product-guide" },
      }),
    ).toThrow(UnsupportedBlogArticleTypeError);
  });

  it("propagates safety errors from unsafe source text", () => {
    expect(() =>
      useCase.execute({
        input: {
          ...input,
          benefits: ["guaranteed results for everyone"],
        },
      }),
    ).toThrow(UnsafeBlogContentError);
  });

  it("generates deterministic repeated use-case output excluding timestamps", () => {
    const first = useCase.execute({ input });
    const second = useCase.execute({ input });

    expect(first.recommendedTitle).toBe(second.recommendedTitle);
    expect(first.sections).toEqual(second.sections);
    expect(first.sourceMetadata).toEqual(second.sourceMetadata);
  });
});
