import { describe, expect, it } from "vitest";
import { SEOKeywordSetFactory, SEOContentOptionsFactory } from "../factories/index.js";
import { SEOKeywordSafetyService, SEOSearchIntentService } from "./index.js";
import { buildSEOInput } from "../../infrastructure/generators/deterministic-seo-content.generator.test.js";

describe("SEO safety and quality policies", () => {
  it("detects keyword stuffing and unsupported modifiers", () => {
    const service = new SEOKeywordSafetyService();

    for (const keyword of [
      "guaranteed rank #1",
      "medical grade cure cream",
      "beauty product near me",
      "casino beauty traffic",
      "cheap cheap cheap product",
    ]) {
      expect(service.inspectKeyword(keyword).length).toBeGreaterThan(0);
    }
  });

  it("allows restrained product keywords", () => {
    expect(new SEOKeywordSafetyService().inspectKeyword("facial cleansing brush")).toEqual([]);
  });

  it("infers search intent deterministically", () => {
    const service = new SEOSearchIntentService();

    expect(service.infer({ ...buildSEOInput(), productTitle: "Brush vs cleansing cloth" })).toBe("comparison");
    expect(service.infer({ ...buildSEOInput(), tags: ["buy skincare"] })).toBe("transactional");
    expect(service.infer({ productId: "info-001", productTitle: "Storage Box" })).toBe("informational");
  });

  it("builds keyword sets without source mutation", () => {
    const input = buildSEOInput();
    const before = JSON.stringify(input);
    const keywordSet = new SEOKeywordSetFactory().create(input, new SEOContentOptionsFactory().create());

    expect(keywordSet.primaryKeyword.value).toContain("lumora");
    expect(JSON.stringify(input)).toBe(before);
  });
});
