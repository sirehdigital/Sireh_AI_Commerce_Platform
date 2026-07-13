import { describe, expect, it } from "vitest";
import { DeterministicBlogContentGenerator } from "../../infrastructure/generators/index.js";
import {
  BlogContentInputFactory,
  BlogContentOptionsFactory,
  BlogFAQFactory,
  BlogImageGuidanceFactory,
  BlogOutlineFactory,
  BlogSectionFactory,
  BlogTitleFactory,
} from "../factories/index.js";
import {
  BlogContentMapper,
  MarketingToBlogInputMapper,
  ProductToBlogInputMapper,
} from "./index.js";

describe("Blog content factories and mappers", () => {
  const inputFactory = new BlogContentInputFactory();
  const optionsFactory = new BlogContentOptionsFactory();
  const input = inputFactory.create({
    productId: "prod-map-1",
    productTitle: "Sireh Desk Lamp",
    brand: "Sireh",
    category: "desk lighting",
    benefits: ["supports focused workspaces"],
    features: ["adjustable angle", "compact base"],
    highlights: ["workspace-friendly"],
    productRisks: ["Confirm electrical specifications before publishing."],
    usageGuidance: ["Use only according to supplied product documentation."],
    targetAudience: { primaryAudience: "home office shoppers" },
  });

  it("normalizes input without mutating source objects", () => {
    const source = {
      productId: " prod-map-2 ",
      productTitle: " Sireh Desk Lamp ",
      benefits: [" focused light ", "focused light"],
    };
    const normalized = inputFactory.create(source);

    expect(normalized.productId).toBe("prod-map-2");
    expect(normalized.productTitle).toBe("Sireh Desk Lamp");
    expect(normalized.benefits).toEqual(["focused light"]);
    expect(source.productId).toBe(" prod-map-2 ");
  });

  it("applies option defaults and clamped counts", () => {
    const options = optionsFactory.create({ faqCount: 99, sectionCount: 99, targetWordCount: 99999 });

    expect(options.articleType).toBe("product-guide");
    expect(options.objective).toBe("education");
    expect(options.faqCount).toBe(8);
    expect(options.sectionCount).toBe(10);
    expect(options.targetWordCount).toBe(1200);
  });

  it("creates titles, outlines, sections, FAQ and image guidance", () => {
    const options = optionsFactory.create({ articleType: "buying-guide", includeFAQ: true });
    const titles = new BlogTitleFactory().create(input, options);
    const outline = new BlogOutlineFactory().create(input, options);
    const sections = new BlogSectionFactory().create(input, options, outline);
    const faq = new BlogFAQFactory().create(input, options);
    const images = new BlogImageGuidanceFactory().create(input, options);

    expect(titles.length).toBeGreaterThan(1);
    expect(outline.every((item, index) => item.order === index + 1)).toBe(true);
    expect(sections.length).toBe(outline.length);
    expect(faq.length).toBeGreaterThan(0);
    expect(images[0]?.altText).toContain("Sireh Desk Lamp");
  });

  it("maps normalized product data into blog input", () => {
    const mapped = new ProductToBlogInputMapper().map({
      id: "p4",
      title: "Sireh Planner",
      brand: "Sireh",
      category: "planning",
      benefits: ["clear weekly planning"],
      features: ["dated pages"],
    });

    expect(mapped.productId).toBe("p4");
    expect(mapped.productTitle).toBe("Sireh Planner");
    expect(mapped.benefits).toEqual(["clear weekly planning"]);
  });

  it("maps marketing metadata into blog input", () => {
    const mapped = new MarketingToBlogInputMapper().map({
      customerPersona: "busy professionals",
      customerSegment: "productivity buyers",
      customerJourneyStage: "consideration",
      marketingAngle: "clarity for weekly routines",
      valueProposition: "simple planning",
      campaignObjective: "consideration",
      campaignId: "campaign-map",
      correlationId: "corr-map",
    });

    expect(mapped.customerPersona).toBe("busy professionals");
    expect(mapped.correlationMetadata?.campaignId).toBe("campaign-map");
    expect(mapped.correlationMetadata?.customerJourneyReference).toBe("consideration");
  });

  it("maps generated package to a stable snapshot", () => {
    const contentPackage = new DeterministicBlogContentGenerator().generate(input, optionsFactory.create());
    const snapshot = new BlogContentMapper().toSnapshot(contentPackage);

    expect(snapshot.productId).toBe(input.productId);
    expect(snapshot.recommendedTitle).toBe(contentPackage.recommendedTitle);
    expect(snapshot.contents.length).toBe(contentPackage.contents.length);
    expect(snapshot.sectionCount).toBe(contentPackage.sections.length);
  });
});
