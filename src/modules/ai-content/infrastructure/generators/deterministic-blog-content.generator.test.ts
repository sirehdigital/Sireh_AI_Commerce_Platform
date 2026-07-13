import { describe, expect, it } from "vitest";
import type { BlogArticleLength, BlogArticleType, BlogChannel } from "../../application/dto/index.js";
import { BlogContentInputFactory, BlogContentOptionsFactory } from "../../application/factories/index.js";
import { DeterministicBlogContentGenerator } from "./deterministic-blog-content.generator.js";

const ARTICLE_TYPES: readonly BlogArticleType[] = [
  "educational-article",
  "product-guide",
  "buying-guide",
  "how-to-article",
  "faq-article",
  "problem-solution-article",
  "feature-spotlight",
  "benefits-article",
  "product-comparison-framework",
  "brand-story",
  "product-launch-article",
  "list-article",
  "myth-versus-fact-framework",
  "beginner-guide",
  "customer-objection-article",
  "use-case-article",
];

const LENGTHS: readonly BlogArticleLength[] = ["short", "medium", "long", "comprehensive"];
const CHANNELS: readonly BlogChannel[] = ["blog", "website", "shopify"];

describe("DeterministicBlogContentGenerator", () => {
  const generator = new DeterministicBlogContentGenerator();
  const inputFactory = new BlogContentInputFactory();
  const optionsFactory = new BlogContentOptionsFactory();

  const input = inputFactory.create({
    productId: "prod-1",
    productTitle: "Sireh Glow Serum",
    brand: "Sireh",
    category: "skincare serum",
    productType: "serum",
    productDescription: "A lightweight serum positioned for everyday skincare routines.",
    benefits: ["supports a simple daily routine", "helps customers compare product fit"],
    features: ["lightweight texture", "daily-use positioning", "compact product format"],
    highlights: ["merchant-approved product guide", "clear usage framing"],
    productRisks: ["Patch testing may be appropriate when merchant documentation confirms it."],
    usageGuidance: ["Apply using merchant-approved instructions only."],
    targetAudience: {
      primaryAudience: "skincare shoppers",
      description: "Consumers comparing everyday skincare products.",
      problems: ["unclear product fit"],
      motivations: ["simple product education"],
    },
    valueProposition: "clear product education",
    targetMarket: "US",
    verifiedResearchFacts: [{ fact: "Merchant documentation confirms the product category." }],
  });

  it("generates deterministic output for repeated execution", () => {
    const options = optionsFactory.create({ articleType: "product-guide", objective: "education" });
    const first = generator.generate(input, options);
    const second = generator.generate(input, options);

    expect(first.recommendedTitle).toBe(second.recommendedTitle);
    expect(first.introduction).toBe(second.introduction);
    expect(first.sections).toEqual(second.sections);
    expect(first.faqSection).toEqual(second.faqSection);
  });

  it("generates English and Malay content", () => {
    const english = generator.generate(input, optionsFactory.create({ language: "en" }));
    const malay = generator.generate(inputFactory.create({ ...input, language: "ms" }), optionsFactory.create({ language: "ms" }));

    expect(english.language).toBe("en");
    expect(malay.language).toBe("ms");
    expect(malay.introduction).toContain("Artikel ini");
  });

  it.each(CHANNELS)("supports the %s channel", (channel) => {
    const output = generator.generate(input, optionsFactory.create({ channel }));

    expect(output.channel).toBe(channel);
    expect(output.contents.some((content) => content.snapshot().type === "blog-article")).toBe(true);
  });

  it.each(ARTICLE_TYPES)("supports article type %s", (articleType) => {
    const output = generator.generate(input, optionsFactory.create({ articleType }));

    expect(output.articleType).toBe(articleType);
    expect(output.outline.length).toBeGreaterThanOrEqual(3);
    expect(output.sections.length).toBe(output.outline.length);
  });

  it.each(LENGTHS)("supports %s length with stable positive metrics", (articleLength) => {
    const output = generator.generate(input, optionsFactory.create({ articleLength }));

    expect(output.readingMetrics.articleLength).toBe(articleLength);
    expect(output.wordCount).toBeGreaterThan(0);
    expect(output.readingMetrics.estimatedReadingMinutes).toBeGreaterThan(0);
  });

  it("does not mutate source input", () => {
    const mutableInput = {
      ...input,
      benefits: [...(input.benefits ?? [])],
      features: [...(input.features ?? [])],
    };
    const before = structuredClone(mutableInput);

    generator.generate(mutableInput, optionsFactory.create());

    expect(mutableInput).toEqual(before);
  });

  it("generates SEO-aware title, slug and metadata without clickbait", () => {
    const output = generator.generate(input, optionsFactory.create({ articleType: "buying-guide", objective: "seo-traffic" }));

    expect(output.titleOptions.length).toBeGreaterThan(1);
    expect(output.recommendedTitle.toLowerCase()).toContain("skincare");
    expect(output.slug).toContain("skincare");
    expect(output.metaTitle.length).toBeLessThanOrEqual(60);
    expect(output.metaDescription.length).toBeLessThanOrEqual(155);
    expect(output.recommendedTitle).not.toMatch(/shocking|you won't believe|!!!/iu);
  });

  it("generates outline, sections, FAQ, CTAs, links and image guidance", () => {
    const output = generator.generate(
      input,
      optionsFactory.create({
        includeFAQ: true,
        includeInternalLinkGuidance: true,
        includeImagePlacementGuidance: true,
        includeExternalSourcePlaceholders: true,
      }),
    );

    expect(output.outline.every((item, index) => item.order === index + 1)).toBe(true);
    expect(output.faqSection.length).toBeGreaterThan(0);
    expect(output.primaryCTA.value.length).toBeGreaterThan(0);
    expect(output.internalLinkAnchorSuggestions.length).toBeGreaterThan(0);
    expect(output.imagePlacementSuggestions.length).toBeGreaterThan(0);
    expect(output.externalSourcePlaceholderGuidance.every((item) => !item.includes("http"))).toBe(true);
  });
});
