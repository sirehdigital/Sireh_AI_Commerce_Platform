import { Content, type ContentCreateInput } from "../../domain/aggregates/content.aggregate.js";
import type { ContentType } from "../../domain/index.js";
import { CTA, Headline } from "../../domain/index.js";
import type {
  ProductContentGenerationInput,
  ProductContentGenerationOptions,
  ProductContentPackage,
  ProductFAQItem,
  ShopifyReadyProductCopyPackage,
} from "../dto/product-content.types.js";

export interface ProductContentTextDraft {
  readonly title: string;
  readonly subtitle: string;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly benefits: readonly string[];
  readonly features: readonly string[];
  readonly highlights: readonly string[];
  readonly problemStatement: string;
  readonly solutionStatement: string;
  readonly valueProposition: string;
  readonly targetAudienceStatement: string;
  readonly brandPositioningStatement: string;
  readonly usageGuidance?: string;
  readonly trustBuildingCopy?: string;
  readonly objectionHandlingCopy?: string;
  readonly faq: readonly ProductFAQItem[];
  readonly callsToAction: readonly string[];
}

export class ProductContentPackageFactory {
  public create(
    input: ProductContentGenerationInput,
    options: ProductContentGenerationOptions,
    draft: ProductContentTextDraft,
  ): ProductContentPackage {
    const base = {
      productId: input.productId,
      channel: options.channel,
      language: options.language,
      tone: options.tone,
    };
    const title = this.content(input, options, "product-title", "title", draft.title);
    const subtitle = this.content(input, options, "generic-content", "subtitle", draft.subtitle);
    const shortDescription = this.content(
      input,
      options,
      "product-description",
      "short-description",
      draft.shortDescription,
    );
    const longDescription = this.content(
      input,
      options,
      "product-description",
      "long-description",
      draft.longDescription,
      { structuredContent: { format: "restrained-conversion-structure" } },
    );
    const benefits = draft.benefits.map((benefit, index) =>
      this.content(input, options, "product-benefits", `benefit-${index + 1}`, benefit),
    );
    const features = draft.features.map((feature, index) =>
      this.content(input, options, "product-features", `feature-${index + 1}`, feature),
    );
    const highlights = draft.highlights.map((highlight, index) =>
      this.content(input, options, "product-features", `highlight-${index + 1}`, highlight),
    );
    const problemStatement = this.content(
      input,
      options,
      "generic-content",
      "problem-statement",
      draft.problemStatement,
    );
    const solutionStatement = this.content(
      input,
      options,
      "generic-content",
      "solution-statement",
      draft.solutionStatement,
    );
    const valueProposition = this.content(
      input,
      options,
      "generic-content",
      "value-proposition",
      draft.valueProposition,
    );
    const targetAudienceStatement = this.content(
      input,
      options,
      "generic-content",
      "target-audience",
      draft.targetAudienceStatement,
    );
    const brandPositioningStatement = this.content(
      input,
      options,
      "generic-content",
      "brand-positioning",
      draft.brandPositioningStatement,
    );
    const usageGuidance =
      draft.usageGuidance === undefined
        ? undefined
        : this.content(input, options, "generic-content", "usage-guidance", draft.usageGuidance);
    const trustBuildingCopy =
      draft.trustBuildingCopy === undefined
        ? undefined
        : this.content(input, options, "generic-content", "trust-building", draft.trustBuildingCopy);
    const objectionHandlingCopy =
      draft.objectionHandlingCopy === undefined
        ? undefined
        : this.content(
            input,
            options,
            "generic-content",
            "objection-handling",
            draft.objectionHandlingCopy,
          );
    const callsToAction = draft.callsToAction.map((cta, index) =>
      this.content(input, options, "cta", `cta-${index + 1}`, cta, {
        cta: CTA.create(cta),
      }),
    );
    const optionalContents = [usageGuidance, trustBuildingCopy, objectionHandlingCopy].filter(
      (content): content is Content => content !== undefined,
    );
    const contents = [
      title,
      subtitle,
      shortDescription,
      longDescription,
      ...benefits,
      ...features,
      ...highlights,
      problemStatement,
      solutionStatement,
      valueProposition,
      targetAudienceStatement,
      brandPositioningStatement,
      ...optionalContents,
      ...callsToAction,
    ];

    return {
      ...base,
      title,
      subtitle,
      shortDescription,
      longDescription,
      benefits,
      features,
      highlights,
      problemStatement,
      solutionStatement,
      valueProposition,
      targetAudienceStatement,
      brandPositioningStatement,
      ...(usageGuidance === undefined ? {} : { usageGuidance }),
      ...(trustBuildingCopy === undefined ? {} : { trustBuildingCopy }),
      ...(objectionHandlingCopy === undefined ? {} : { objectionHandlingCopy }),
      faq: [...draft.faq],
      callsToAction,
      shopifyReady: this.shopifyReady(draft),
      contents,
      generatedAt: new Date(),
    };
  }

  private content(
    input: ProductContentGenerationInput,
    options: ProductContentGenerationOptions,
    type: ContentType,
    component: string,
    text: string,
    overrides: Partial<ContentCreateInput> = {},
  ): Content {
    const id = `content:${input.productId}:${options.channel}:${component}`;
    const headline = Headline.create(text.slice(0, 120));
    const metadata = {
      sourceProductId: input.productId,
      ...(input.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      tags: ["product-content", component],
      custom: { component },
    };

    return Content.create({
      id,
      type,
      channel: options.channel,
      language: options.language,
      tone: options.tone,
      headline,
      body: text,
      metadata,
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
      ...overrides,
    });
  }

  private shopifyReady(draft: ProductContentTextDraft): ShopifyReadyProductCopyPackage {
    return {
      title: draft.title,
      subtitle: draft.subtitle,
      descriptionHtml: toShopifyHtml(draft),
      benefits: [...draft.benefits],
      features: [...draft.features],
      highlights: [...draft.highlights],
      callsToAction: [...draft.callsToAction],
    };
  }
}

function toShopifyHtml(draft: ProductContentTextDraft): string {
  const paragraphs = [draft.shortDescription, draft.longDescription]
    .map((value) => `<p>${escapeHtml(value)}</p>`)
    .join("");
  const benefits = draft.benefits.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  const features = draft.features.map((value) => `<li>${escapeHtml(value)}</li>`).join("");

  return `${paragraphs}<h3>Benefits</h3><ul>${benefits}</ul><h3>Features</h3><ul>${features}</ul>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}
