import type { EmailContentGenerationInput } from "../dto/email-content.types.js";
import { MissingEmailCampaignContextError } from "../errors/product-content.errors.js";

export class EmailContentInputFactory {
  public create(input: EmailContentGenerationInput): EmailContentGenerationInput {
    const productId = clean(input.productId);
    const productTitle = clean(input.productTitle);

    if (productId === undefined) {
      throw new MissingEmailCampaignContextError("Product ID is required for email content generation.");
    }
    if (productTitle === undefined) {
      throw new MissingEmailCampaignContextError("Product title is required for email content generation.");
    }

    const productSubtitle = clean(input.productSubtitle);
    const brand = clean(input.brand);
    const category = clean(input.category);
    const productType = clean(input.productType);
    const productDescription = clean(input.productDescription);
    const customerPersona = clean(input.customerPersona);
    const customerSegment = clean(input.customerSegment);
    const marketingAngle = clean(input.marketingAngle);
    const valueProposition = clean(input.valueProposition);
    const lifecycleStage = clean(input.lifecycleStage);
    const purchaseContext = clean(input.purchaseContext);

    return {
      productId,
      productTitle,
      ...(productSubtitle === undefined ? {} : { productSubtitle }),
      ...(brand === undefined ? {} : { brand }),
      ...(category === undefined ? {} : { category }),
      ...(productType === undefined ? {} : { productType }),
      ...(productDescription === undefined ? {} : { productDescription }),
      benefits: cleanList(input.benefits),
      features: cleanList(input.features),
      highlights: cleanList(input.highlights),
      productRisks: cleanList(input.productRisks),
      usageGuidance: cleanList(input.usageGuidance),
      ...(input.productContentPackage === undefined ? {} : { productContentPackage: input.productContentPackage }),
      ...(input.seoContentPackage === undefined ? {} : { seoContentPackage: input.seoContentPackage }),
      ...(input.socialMediaContentPackage === undefined ? {} : { socialMediaContentPackage: input.socialMediaContentPackage }),
      ...(input.videoScriptPackage === undefined ? {} : { videoScriptPackage: input.videoScriptPackage }),
      ...(input.targetAudience === undefined ? {} : { targetAudience: input.targetAudience }),
      ...(customerPersona === undefined ? {} : { customerPersona }),
      ...(customerSegment === undefined ? {} : { customerSegment }),
      ...(marketingAngle === undefined ? {} : { marketingAngle }),
      ...(valueProposition === undefined ? {} : { valueProposition }),
      ...(input.campaignObjective === undefined ? {} : { campaignObjective: input.campaignObjective }),
      ...(input.customerJourneyStage === undefined ? {} : { customerJourneyStage: input.customerJourneyStage }),
      ...(lifecycleStage === undefined ? {} : { lifecycleStage }),
      ...(purchaseContext === undefined ? {} : { purchaseContext }),
      ...(input.cartContext === undefined ? {} : { cartContext: input.cartContext }),
      ...(input.browseContext === undefined ? {} : { browseContext: input.browseContext }),
      ...(input.orderContext === undefined ? {} : { orderContext: input.orderContext }),
      ...(input.offerContext === undefined ? {} : { offerContext: input.offerContext }),
      ...(input.stockContext === undefined ? {} : { stockContext: input.stockContext }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(input.sourceMarketingAnalysisId === undefined ? {} : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function cleanList(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values ?? []).map((value) => clean(value)).filter((value): value is string => value !== undefined))];
}
