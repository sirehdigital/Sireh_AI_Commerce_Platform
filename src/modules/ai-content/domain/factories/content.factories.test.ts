import { describe, expect, it } from "vitest";
import { ContentTemplate } from "../entities/content-template.entity.js";
import { InvalidContentValueError, InvalidQualityScoreError } from "../errors/index.js";
import { ContentFactory } from "./content.factory.js";
import { ContentSEOFactory } from "./content-seo.factory.js";
import { ContentScoreFactory } from "./content-score.factory.js";
import { ContentTemplateFactory } from "./content-template.factory.js";

describe("AI Content domain factories", () => {
  it("creates content with normalized headline and safe defaults", () => {
    const content = new ContentFactory().create({
      id: "content-factory-001",
      type: "product-title",
      channel: "shopify",
      language: "en",
      tone: "friendly",
      headline: "  Clean   Glow Serum  ",
    });

    const snapshot = content.snapshot();

    expect(snapshot.headline.value).toBe("Clean Glow Serum");
    expect(snapshot.status).toBe("draft");
    expect(snapshot.revision).toBe(1);
  });

  it("rejects invalid content factory input through value objects", () => {
    expect(() =>
      new ContentFactory().create({
        id: "content-factory-002",
        type: "product-title",
        channel: "shopify",
        language: "en",
        tone: "friendly",
        headline: " ",
      }),
    ).toThrow(InvalidContentValueError);
  });

  it("creates SEO objects with normalized values", () => {
    const seo = new ContentSEOFactory().create({
      primaryKeyword: "  Glow   Serum ",
      secondaryKeywords: ["  Beauty Care  "],
      metaTitle: " Glow Serum for Daily Routines ",
      metaDescription: " Lightweight serum for everyday skincare routines. ",
      slug: " Glow Serum Launch ",
      searchIntent: "commercial",
    });

    expect(seo.primaryKeyword?.value).toBe("glow serum");
    expect(seo.secondaryKeywords[0]?.value).toBe("beauty care");
    expect(seo.metaTitle?.value).toBe("Glow Serum for Daily Routines");
    expect(seo.metaDescription?.value).toBe("Lightweight serum for everyday skincare routines.");
    expect(seo.slug?.value).toBe("glow-serum-launch");
    expect(seo.indexable).toBe(true);
  });

  it("creates content score objects and rejects invalid score input", () => {
    const score = new ContentScoreFactory().create({
      overallQuality: 88.5,
      clarity: 91,
      evaluationNotes: ["Ready for human review"],
    });

    expect(score.overallQuality.value).toBe(88.5);
    expect(score.clarity?.value).toBe(91);
    expect(score.evaluationNotes).toEqual(["Ready for human review"]);
    expect(() => new ContentScoreFactory().create({ overallQuality: 101 })).toThrow(
      InvalidQualityScoreError,
    );
  });

  it("creates content templates with deterministic defaults", () => {
    const template = new ContentTemplateFactory().create({
      id: "template-001",
      name: "Product Description Template",
      contentType: "product-description",
      channel: "shopify",
      sections: [{ key: "body", label: "Body", required: true }],
      requiredVariables: ["productTitle", "productTitle"],
      optionalVariables: ["brandName"],
    });

    expect(template).toBeInstanceOf(ContentTemplate);
    expect(template.snapshot()).toMatchObject({
      id: "template-001",
      version: 1,
      active: true,
      requiredVariables: ["productTitle"],
    });
  });
});
