import { describe, expect, it } from "vitest";
import {
  CTA,
  CONTENT_VALUE_LIMITS,
  ContentLength,
  Headline,
  MetaDescription,
  MetaTitle,
  QualityScore,
  ReadingTime,
  SEOKeyword,
  Slug,
} from "./index.js";

describe("AI Content value objects", () => {
  it("creates, trims and compares headlines", () => {
    const headline = Headline.create("  Premium   Glow Serum  ");

    expect(headline.value).toBe("Premium Glow Serum");
    expect(headline.equals(Headline.create("Premium Glow Serum"))).toBe(true);
  });

  it("rejects invalid headline boundaries", () => {
    expect(() => Headline.create("  ")).toThrow();
    expect(() => Headline.create("ab")).toThrow();
    expect(() => Headline.create("x".repeat(CONTENT_VALUE_LIMITS.headlineMaxLength + 1))).toThrow();
    expect(Headline.create("x".repeat(CONTENT_VALUE_LIMITS.headlineMaxLength)).value).toHaveLength(
      CONTENT_VALUE_LIMITS.headlineMaxLength,
    );
  });

  it("creates and bounds CTA text", () => {
    expect(CTA.create("  Shop   now  ").value).toBe("Shop now");
    expect(() => CTA.create(" ")).toThrow();
    expect(() => CTA.create("x".repeat(CONTENT_VALUE_LIMITS.ctaMaxLength + 1))).toThrow();
  });

  it("normalizes SEO keywords", () => {
    expect(SEOKeyword.create("  Beauty   Serum  ").value).toBe("beauty serum");
    expect(() => SEOKeyword.create(" ")).toThrow();
    expect(() => SEOKeyword.create("x".repeat(CONTENT_VALUE_LIMITS.keywordMaxLength + 1))).toThrow();
  });

  it("validates meta title and meta description boundaries", () => {
    expect(MetaTitle.create("  Clean Beauty Serum  ").value).toBe("Clean Beauty Serum");
    expect(MetaDescription.create("  Lightweight serum for daily routines.  ").value).toBe(
      "Lightweight serum for daily routines.",
    );
    expect(() => MetaTitle.create(" ")).toThrow();
    expect(() => MetaDescription.create(" ")).toThrow();
    expect(() => MetaTitle.create("x".repeat(CONTENT_VALUE_LIMITS.metaTitleMaxLength + 1))).toThrow();
    expect(() =>
      MetaDescription.create("x".repeat(CONTENT_VALUE_LIMITS.metaDescriptionMaxLength + 1)),
    ).toThrow();
  });

  it("normalizes deterministic slugs and rejects empty normalized slugs", () => {
    expect(Slug.create("  Glow Serum_launch!! 2026  ").value).toBe("glow-serum-launch-2026");
    expect(Slug.create("__Clean   Beauty__").value).toBe("clean-beauty");
    expect(() => Slug.create("!!!")).toThrow();
  });

  it("validates reading time as positive finite minutes", () => {
    expect(ReadingTime.create(1.2).minutes).toBe(2);
    expect(() => ReadingTime.create(0)).toThrow();
    expect(() => ReadingTime.create(-1)).toThrow();
    expect(() => ReadingTime.create(Number.NaN)).toThrow();
    expect(() => ReadingTime.create(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("represents content length without ambiguous raw numbers", () => {
    const length = ContentLength.fromText("One two three");

    expect(length.wordCount).toBe(3);
    expect(length.characterCount).toBe(13);
    expect(length.equals(ContentLength.create({ wordCount: 3, characterCount: 13 }))).toBe(true);
    expect(() => ContentLength.create({ wordCount: -1, characterCount: 1 })).toThrow();
    expect(() => ContentLength.create({ wordCount: Number.NaN, characterCount: 1 })).toThrow();
    expect(() =>
      ContentLength.create({ wordCount: 1, characterCount: Number.POSITIVE_INFINITY }),
    ).toThrow();
  });

  it("accepts decimal quality scores within the centralized range", () => {
    expect(QualityScore.create(0).value).toBe(0);
    expect(QualityScore.create(72.5).value).toBe(72.5);
    expect(QualityScore.create(100).equals(QualityScore.create(100))).toBe(true);
    expect(() => QualityScore.create(-0.1)).toThrow();
    expect(() => QualityScore.create(100.1)).toThrow();
    expect(() => QualityScore.create(Number.NaN)).toThrow();
    expect(() => QualityScore.create(Number.POSITIVE_INFINITY)).toThrow();
  });
});
