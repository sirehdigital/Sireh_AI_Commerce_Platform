import type { BlogContentGenerationInput } from "../dto/blog-content.types.js";
import { MissingBlogSourceError } from "../errors/product-content.errors.js";

export class BlogContentInputFactory {
  public create(input: BlogContentGenerationInput): BlogContentGenerationInput {
    const productId = clean(input.productId);
    const productTitle = clean(input.productTitle);

    if (productId === undefined) {
      throw new MissingBlogSourceError("Product ID is required for blog content generation.");
    }
    if (productTitle === undefined) {
      throw new MissingBlogSourceError("Product title is required for blog content generation.");
    }

    const productSubtitle = clean(input.productSubtitle);
    const brand = clean(input.brand);
    const category = clean(input.category);
    const productType = clean(input.productType);
    const productDescription = clean(input.productDescription);
    const customerPersona = clean(input.customerPersona);
    const customerSegment = clean(input.customerSegment);
    const awarenessLevel = clean(input.awarenessLevel);
    const customerJourneyStage = clean(input.customerJourneyStage);
    const marketingAngle = clean(input.marketingAngle);
    const valueProposition = clean(input.valueProposition);
    const targetMarket = clean(input.targetMarket);
    const seasonOrEvent = clean(input.seasonOrEvent);
    const trendContext = clean(input.trendContext);

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
      materialsOrIngredients: cleanList(input.materialsOrIngredients),
      ...(input.productContentPackage === undefined ? {} : { productContentPackage: input.productContentPackage }),
      ...(input.seoContentPackage === undefined ? {} : { seoContentPackage: input.seoContentPackage }),
      ...(input.socialMediaContentPackage === undefined ? {} : { socialMediaContentPackage: input.socialMediaContentPackage }),
      ...(input.videoScriptPackage === undefined ? {} : { videoScriptPackage: input.videoScriptPackage }),
      ...(input.emailContentPackage === undefined ? {} : { emailContentPackage: input.emailContentPackage }),
      ...(input.targetAudience === undefined ? {} : { targetAudience: input.targetAudience }),
      ...(customerPersona === undefined ? {} : { customerPersona }),
      ...(customerSegment === undefined ? {} : { customerSegment }),
      ...(awarenessLevel === undefined ? {} : { awarenessLevel }),
      ...(customerJourneyStage === undefined ? {} : { customerJourneyStage }),
      ...(marketingAngle === undefined ? {} : { marketingAngle }),
      ...(valueProposition === undefined ? {} : { valueProposition }),
      ...(input.campaignObjective === undefined ? {} : { campaignObjective: input.campaignObjective }),
      ...(input.searchIntent === undefined ? {} : { searchIntent: input.searchIntent }),
      ...(targetMarket === undefined ? {} : { targetMarket }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      verifiedResearchFacts: cleanFacts(input.verifiedResearchFacts) ?? [],
      sourceReferences: cleanReferences(input.sourceReferences) ?? [],
      ...(seasonOrEvent === undefined ? {} : { seasonOrEvent }),
      ...(trendContext === undefined ? {} : { trendContext }),
      ...(input.correlationMetadata === undefined ? {} : { correlationMetadata: input.correlationMetadata }),
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

function cleanFacts(values: BlogContentGenerationInput["verifiedResearchFacts"]): BlogContentGenerationInput["verifiedResearchFacts"] {
  return (values ?? [])
    .map((value) => {
      const fact = clean(value.fact);
      const sourceReference = clean(value.sourceReference);
      return fact === undefined ? undefined : { fact, ...(sourceReference === undefined ? {} : { sourceReference }) };
    })
    .filter((value): value is NonNullable<BlogContentGenerationInput["verifiedResearchFacts"]>[number] => value !== undefined);
}

function cleanReferences(values: BlogContentGenerationInput["sourceReferences"]): BlogContentGenerationInput["sourceReferences"] {
  return (values ?? [])
    .map((value) => {
      const label = clean(value.label);
      return label === undefined ? undefined : { label, referenceType: value.referenceType };
    })
    .filter((value): value is NonNullable<BlogContentGenerationInput["sourceReferences"]>[number] => value !== undefined);
}
