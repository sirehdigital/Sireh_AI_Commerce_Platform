import { describe, expect, it } from "vitest";
import { CTA, Headline, QualityScore } from "../value-objects/index.js";
import { Content } from "./content.aggregate.js";

describe("Content aggregate", () => {
  it("constructs valid draft content with defaults and protected snapshots", () => {
    const content = buildContent();
    const snapshot = content.snapshot();

    expect(snapshot.status).toBe("draft");
    expect(snapshot.revision).toBe(1);
    expect(snapshot.metadata.tags).toEqual([]);
    expect(snapshot.contentLength.wordCount).toBeGreaterThan(0);

    const localTags = [...snapshot.metadata.tags];
    localTags.push("mutated");

    expect(content.snapshot().metadata.tags).toEqual([]);
  });

  it("updates content fields through controlled methods and increments revision", () => {
    const content = buildContent();

    content.updateHeadline(Headline.create("Updated product headline"));
    content.updateBody("Updated body for Shopify content.");
    content.assignCTA(CTA.create("Buy now"));
    content.assignAudience({ targetMarket: "US", description: "Beauty consumers" });
    content.changeTone("professional");
    content.changeLanguage("ms");
    content.assignTemplate("template-001");
    content.assignScore({
      overallQuality: QualityScore.create(80),
      evaluationNotes: ["Clear enough for review"],
    });
    content.updateMetadata({ tags: ["beauty"], campaignId: "campaign-001" });

    const snapshot = content.snapshot();

    expect(snapshot.headline.value).toBe("Updated product headline");
    expect(snapshot.body).toBe("Updated body for Shopify content.");
    expect(snapshot.cta?.value).toBe("Buy now");
    expect(snapshot.audience?.targetMarket).toBe("US");
    expect(snapshot.tone).toBe("professional");
    expect(snapshot.language).toBe("ms");
    expect(snapshot.templateId).toBe("template-001");
    expect(snapshot.score?.overallQuality.value).toBe(80);
    expect(snapshot.metadata.tags).toEqual(["beauty"]);
    expect(snapshot.metadata.campaignId).toBe("campaign-001");
    expect(snapshot.revision).toBe(10);
  });

  it("assigns and removes CTA when the content type allows it", () => {
    const content = buildContent();

    content.assignCTA(CTA.create("Explore now"));
    expect(content.snapshot().cta?.value).toBe("Explore now");

    content.removeCTA();
    expect(content.snapshot().cta).toBeUndefined();
  });

  it("enforces valid lifecycle transitions", () => {
    const content = buildContent();

    content.markGenerated();
    content.markReviewed();
    content.approve();
    content.publish();
    content.archive();

    expect(content.status).toBe("archived");
  });

  it("rejects invalid lifecycle transitions and publishing restrictions", () => {
    const content = buildContent();

    expect(() => content.publish()).toThrow();
    expect(() => content.approve()).toThrow();
  });

  it("supports rejected content returning to draft for rework", () => {
    const content = buildContent();

    content.markGenerated();
    content.reject();
    content.returnToDraftForRework();

    expect(content.status).toBe("draft");
  });

  it("rejects invalid aggregate construction", () => {
    expect(() =>
      Content.create({
        id: "content-002",
        type: "product-description",
        channel: "shopify",
        language: "en",
        tone: "friendly",
        headline: Headline.create("Valid headline"),
      }),
    ).toThrow();
  });
});

function buildContent(): Content {
  return Content.create({
    id: "content-001",
    type: "product-description",
    channel: "shopify",
    language: "en",
    tone: "friendly",
    headline: Headline.create("Glow serum product description"),
    body: "A clean product description for a future Shopify listing.",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  });
}
