import { describe, expect, it } from "vitest";
import { DeterministicBlogContentGenerator } from "../../infrastructure/generators/index.js";
import {
  BlogContentInputFactory,
  BlogContentOptionsFactory,
  BlogReadingMetricsFactory,
} from "../factories/index.js";
import {
  MissingBlogSourceError,
  UnsupportedBlogArticleTypeError,
  UnsafeBlogContentError,
} from "../errors/index.js";
import { BlogCompatibilityValidationService } from "./blog-compatibility-validation.service.js";
import { BlogContentSafetyService } from "./blog-content-safety.service.js";
import { BlogEditorialEvidenceService } from "./blog-editorial-evidence.service.js";
import { BlogReadabilityValidationService } from "./blog-readability-validation.service.js";

describe("Blog safety and editorial validation", () => {
  const safety = new BlogContentSafetyService();

  it.each([
    "This cure works for everyone.",
    "A study published says 90% improvement.",
    "Verified review: five-star review.",
    "Last chance, only today.",
    "Use coupon code SAVE50.",
    "You won't believe this shocking truth!!!",
  ])("rejects unsafe blog text: %s", (text) => {
    expect(() => safety.validateText(text)).toThrow(UnsafeBlogContentError);
  });

  it("accepts restrained blog text", () => {
    expect(() => safety.validateText("This guide uses supplied product facts and avoids unsupported claims.")).not.toThrow();
  });

  it("validates article-type source requirements", () => {
    const input = new BlogContentInputFactory().create({ productId: "p1", productTitle: "Product" });
    const compatibility = new BlogCompatibilityValidationService();

    expect(() =>
      compatibility.validateInput(input, new BlogContentOptionsFactory().create({ articleType: "product-care-article" })),
    ).toThrow(MissingBlogSourceError);
    expect(() =>
      compatibility.validateInput(input, new BlogContentOptionsFactory().create({ articleType: "seasonal-article" })),
    ).toThrow(UnsupportedBlogArticleTypeError);
    expect(() =>
      compatibility.validateInput(input, new BlogContentOptionsFactory().create({ articleType: "trend-article" })),
    ).toThrow(UnsupportedBlogArticleTypeError);
  });

  it("produces evidence placeholders without fabricated URLs", () => {
    const input = new BlogContentInputFactory().create({
      productId: "p2",
      productTitle: "Product",
      category: "home product",
      benefits: ["clear home organization"],
      features: ["compact format"],
    });
    const options = new BlogContentOptionsFactory().create({ articleType: "buying-guide" });
    const output = new DeterministicBlogContentGenerator().generate(input, options);
    const placeholders = new BlogEditorialEvidenceService().placeholders(input, output);

    expect(placeholders.length).toBeGreaterThan(0);
    expect(placeholders.join(" ")).not.toMatch(/https?:\/\//u);
  });

  it("reports readability notes and validates normal output", () => {
    const input = new BlogContentInputFactory().create({
      productId: "p3",
      productTitle: "Product",
      category: "pet accessory",
      benefits: ["simple product education"],
      features: ["portable design"],
      productRisks: ["Confirm usage details before publishing."],
    });
    const output = new DeterministicBlogContentGenerator().generate(input, new BlogContentOptionsFactory().create());
    const readability = new BlogReadabilityValidationService();

    expect(readability.inspect(output)).toEqual([]);
    expect(() => readability.validate(output)).not.toThrow();
  });

  it("estimates reading metrics deterministically", () => {
    const metricsFactory = new BlogReadingMetricsFactory();
    const first = metricsFactory.create("one two three four five", "short");
    const second = metricsFactory.create("one two three four five", "short");

    expect(first).toEqual(second);
    expect(first.estimatedWordCount).toBe(5);
    expect(first.estimatedReadingMinutes).toBe(1);
  });
});
