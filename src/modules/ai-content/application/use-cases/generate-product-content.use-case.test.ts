import { describe, expect, it } from "vitest";
import { DeterministicProductContentGenerator } from "../../infrastructure/generators/index.js";
import {
  MissingProductContentSourceError,
  UnsafeContentClaimError,
  UnsupportedContentLanguageError,
  UnsupportedProductContentChannelError,
} from "../errors/index.js";
import { GenerateProductContentUseCase } from "./generate-product-content.use-case.js";

describe("GenerateProductContentUseCase", () => {
  it("generates a complete product content package mapped to Content aggregates", () => {
    const result = new GenerateProductContentUseCase(new DeterministicProductContentGenerator()).execute({
      input: buildUseCaseInput(),
      options: {
        channel: "shopify",
        language: "en",
        tone: "friendly",
        templateId: "template-product-copy",
      },
    });

    expect(result.productId).toBe("product-use-case-001");
    expect(result.contents.length).toBeGreaterThan(10);
    expect(result.title.snapshot().type).toBe("product-title");
    expect(result.shortDescription.snapshot().status).toBe("draft");
    expect(result.contents.every((content) => content.snapshot().channel === "shopify")).toBe(true);
    expect(result.contents.every((content) => content.snapshot().language === "en")).toBe(true);
    expect(result.contents.every((content) => content.snapshot().tone === "friendly")).toBe(true);
    expect(result.contents.every((content) => content.snapshot().metadata.sourceProductId === result.productId)).toBe(
      true,
    );
    expect(result.contents.every((content) => content.snapshot().metadata.templateId === "template-product-copy")).toBe(
      true,
    );
    expect(result.shopifyReady.descriptionHtml).toContain("<p>");
  });

  it("preserves marketing metadata and template reference", () => {
    const result = new GenerateProductContentUseCase(new DeterministicProductContentGenerator()).execute({
      input: {
        ...buildUseCaseInput(),
        campaignId: "campaign-001",
        sourceMarketingAnalysisId: "marketing-001",
        correlationId: "correlation-001",
      },
      options: { templateId: "template-001" },
    });
    const snapshot = result.valueProposition.snapshot();

    expect(snapshot.metadata.campaignId).toBe("campaign-001");
    expect(snapshot.metadata.sourceMarketingAnalysisId).toBe("marketing-001");
    expect(snapshot.metadata.correlationId).toBe("correlation-001");
    expect(snapshot.templateId).toBe("template-001");
  });

  it("rejects missing required source data", () => {
    expect(() =>
      new GenerateProductContentUseCase(new DeterministicProductContentGenerator()).execute({
        input: {
          productId: " ",
          productTitle: " ",
        },
      }),
    ).toThrow(MissingProductContentSourceError);
  });

  it("rejects unsupported language and channel", () => {
    const useCase = new GenerateProductContentUseCase(new DeterministicProductContentGenerator());

    expect(() =>
      useCase.execute({
        input: buildUseCaseInput(),
        options: { language: "fr" },
      }),
    ).toThrow(UnsupportedContentLanguageError);

    expect(() =>
      useCase.execute({
        input: buildUseCaseInput(),
        options: { channel: "email" },
      }),
    ).toThrow(UnsupportedProductContentChannelError);
  });

  it("rejects unsafe generated claims in strict mode", () => {
    expect(() =>
      new GenerateProductContentUseCase(new DeterministicProductContentGenerator()).execute({
        input: {
          ...buildUseCaseInput(),
          productTitle: "Guaranteed Best Beauty Device",
        },
      }),
    ).toThrow(UnsafeContentClaimError);
  });
});

function buildUseCaseInput() {
  return {
    productId: "product-use-case-001",
    productTitle: "Radiance Facial Cleansing Brush",
    productDescription: "A silicone cleansing brush designed for daily face-care routines.",
    brand: "Lumora",
    category: "Beauty Care",
    features: ["Soft silicone touchpoints", "Daily routine use"],
    benefits: ["Supports a simple cleansing routine"],
    targetMarkets: ["US", "UK"],
    marketingAudience: {
      primaryAudience: "beauty enthusiasts",
      customerProblems: ["finding simple skincare tools"],
      objections: ["delivery timing uncertainty"],
    },
    valueProposition: "a practical tool for daily cleansing routines",
  };
}
