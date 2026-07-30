import { describe, expect, it } from "vitest";

import type { TenantContext } from "../../../saie/application/index.js";
import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../../saie/infrastructure/index.js";
import { InMemoryMarketingRepository } from "../../infrastructure/index.js";
import {
  ContentFormatter,
  ContentGenerationService,
  ContentTemplateService,
  ContentValidator,
  ContentVariantGenerator,
} from "./content-generation-services.js";

const tenant: TenantContext = {
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
};

const now = new Date("2026-07-30T17:00:00.000Z");

const idGenerator = (): (() => string) => {
  let id = 0;
  return () => `content-id-${(id += 1).toString().padStart(3, "0")}`;
};

const input = {
  name: "Velvet Glow Launch Content",
  brandName: "Lumora Beauty",
  productName: "Velvet Glow Body Lotion",
  audienceName: "Premium skincare buyers",
  audienceSegments: ["body care", "luxury skincare"],
  goalType: "SALES" as const,
  channel: "SHOPIFY" as const,
  variant: "LUXURY" as const,
  contentTypes: ["PRODUCT_DESCRIPTION", "META_TITLE", "META_DESCRIPTION"] as const,
  benefits: ["soft glowing skin", "daily hydration"],
  features: ["botanical oils", "silky finish"],
  keywords: ["body lotion", "glow skin", "Lumora"],
  callToAction: "Shop Velvet Glow",
  requestedBy: "merchant",
};

describe("Content Generation Engine", () => {
  it("renders deterministic templates, variants, and formatted SEO output", () => {
    const template = new ContentTemplateService();
    const variant = new ContentVariantGenerator();
    const formatter = new ContentFormatter();

    const metaTitle = formatter.format("META_TITLE", variant.apply(template.render(input, "META_TITLE"), "LONG"));

    expect(metaTitle.length).toBeLessThanOrEqual(60);
    expect(metaTitle).toContain("Velvet Glow");
  });

  it("generates review-gated content with approval and audit records", async () => {
    const repository = new InMemoryMarketingRepository();
    const approvalRepository = new InMemoryApprovalRepository([]);
    const auditRepository = new InMemoryAuditRepository();
    const service = new ContentGenerationService({
      repository,
      approvalRepository,
      auditRepository,
      now: () => now,
      idGenerator: idGenerator(),
    });

    const content = await service.generate(input, tenant);

    expect(content.workflowState).toBe("Review");
    expect(content.approvalId).toBeDefined();
    expect(content.sections.map((section) => section.type)).toEqual(expect.arrayContaining([
      "PRODUCT_DESCRIPTION",
      "SHORT_DESCRIPTION",
      "BENEFITS",
      "FEATURES",
      "CALL_TO_ACTION",
      "META_TITLE",
      "META_DESCRIPTION",
    ]));
    expect(content.validation).toMatchObject({ errors: [], approvalRequired: true, readyForReview: true });
    expect(approvalRepository.findById(tenant, content.approvalId!)).toMatchObject({ status: "pending", executionEnabled: false });
    expect(auditRepository.list(tenant).map((record) => record.details.marketingEventType)).toEqual(expect.arrayContaining([
      "CONTENT_GENERATED",
      "CONTENT_VALIDATED",
    ]));
  });

  it("validates duplicate sections, missing CTA, missing keywords, and compatibility", () => {
    const report = new ContentValidator().validate({
      content: {
        channel: "EMAIL",
        goalType: "SALES",
        contentTypes: ["BLOG_OUTLINE", "BLOG_OUTLINE"],
        sections: [
          { type: "BLOG_OUTLINE", title: "Outline", body: "Outline", keywords: [] },
          { type: "BLOG_OUTLINE", title: "Outline", body: "Outline", keywords: [] },
        ],
      },
    });

    expect(report.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "CONTENT_DUPLICATE_SECTIONS",
      "CONTENT_KEYWORDS_MISSING",
      "CONTENT_CHANNEL_COMPATIBILITY_FAILED",
    ]));
    expect(report.warnings.map((issue) => issue.code)).toContain("CONTENT_CTA_MISSING");
  });
});

