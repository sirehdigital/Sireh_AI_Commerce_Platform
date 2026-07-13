import { describe, expect, it } from "vitest";
import { ContentTemplate } from "../entities/content-template.entity.js";
import { InvalidContentSEOConfigurationError } from "../errors/index.js";
import { ContentSEOFactory } from "../factories/content-seo.factory.js";
import type { ContentChannel, ContentStatus, ContentType } from "../types/index.js";
import { ContentCompatibilityValidator } from "./content-compatibility.validator.js";
import { ContentSEOValidator } from "./content-seo.validator.js";
import { ContentStatusTransitionValidator } from "./content-status-transition.validator.js";
import { ContentTemplateCompatibilityValidator } from "./content-template-compatibility.validator.js";

describe("AI Content domain validators", () => {
  it("allows every supported lifecycle transition", () => {
    const validator = new ContentStatusTransitionValidator();
    const allowed: readonly [ContentStatus, ContentStatus][] = [
      ["draft", "generated"],
      ["draft", "archived"],
      ["generated", "reviewed"],
      ["generated", "rejected"],
      ["generated", "archived"],
      ["reviewed", "approved"],
      ["reviewed", "rejected"],
      ["reviewed", "archived"],
      ["approved", "published"],
      ["approved", "archived"],
      ["rejected", "draft"],
      ["rejected", "archived"],
      ["published", "archived"],
    ];

    for (const [from, to] of allowed) {
      expect(validator.canTransition(from, to)).toBe(true);
    }
  });

  it("rejects invalid lifecycle transitions", () => {
    const validator = new ContentStatusTransitionValidator();

    expect(validator.canTransition("draft", "published")).toBe(false);
    expect(() => validator.assertCanTransition("archived", "draft")).toThrow();
  });

  it("validates content type and channel compatibility", () => {
    const validator = new ContentCompatibilityValidator();

    expect(validator.isCompatible("product-description", "shopify")).toBe(true);
    expect(validator.isCompatible("email-subject", "email")).toBe(true);
    expect(validator.isCompatible("email-subject", "tiktok")).toBe(false);
    expect(() => validator.assertCompatible("blog-article", "facebook")).toThrow();
  });

  it("validates SEO requirements for SEO-oriented content", () => {
    const validator = new ContentSEOValidator();
    const seo = new ContentSEOFactory().create({
      primaryKeyword: "beauty serum",
      metaTitle: "Beauty Serum",
      metaDescription: "Beauty serum for daily routines.",
    });

    expect(() => validator.assertValid("seo-title", seo)).not.toThrow();
    expect(() => validator.assertValid("seo-description", seo)).not.toThrow();
    expect(() => validator.assertValid("blog-article", seo)).not.toThrow();
    expect(() => validator.assertValid("seo-title", undefined)).toThrow(
      InvalidContentSEOConfigurationError,
    );
  });

  it("validates template compatibility", () => {
    const template = ContentTemplate.create({
      id: "template-validator-001",
      name: "Shopify Description",
      contentType: "product-description",
      channel: "shopify",
    }).snapshot();
    const validator = new ContentTemplateCompatibilityValidator();

    expect(() =>
      validator.assertCompatible(template, "product-description", "shopify"),
    ).not.toThrow();
    expect(() => validator.assertCompatible(template, "email-body", "email")).toThrow();
  });

  it("keeps compatibility checks explicit for future content expansion", () => {
    const validator = new ContentCompatibilityValidator();
    const matrix: readonly [ContentType, ContentChannel, boolean][] = [
      ["social-caption", "instagram", true],
      ["video-script", "youtube", true],
      ["landing-page-copy", "website", true],
      ["landing-page-copy", "email", false],
    ];

    for (const [type, channel, expected] of matrix) {
      expect(validator.isCompatible(type, channel)).toBe(expected);
    }
  });
});
