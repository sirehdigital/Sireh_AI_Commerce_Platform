import type { AIContentOrchestrationInput } from "../../application/dto/ai-content-orchestration.types.js";
import {
  completeBeautyProduct,
  productAnalysis,
  productCopy,
  productRisk,
} from "../fixtures/product.fixtures.js";
import { marketingFixture } from "../fixtures/marketing.fixtures.js";

export function buildOrchestrationInput(
  overrides: Partial<AIContentOrchestrationInput> = {},
): AIContentOrchestrationInput {
  const product = completeBeautyProduct();
  return {
    product: { product, analysis: productAnalysis(), copy: productCopy(), risk: productRisk() },
    targetMarket: "US",
    customerPersona: marketingFixture.customerPersona,
    customerSegment: marketingFixture.customerSegment,
    valueProposition: marketingFixture.valueProposition,
    campaignObjective: marketingFixture.campaignObjective,
    customerJourneyStage: marketingFixture.customerJourneyStage,
    verifiedClaims: ["Soft silicone touchpoints"],
    verifiedOffers: [],
    sourceLanguage: "en",
    sourceLocale: "en-US",
    targetLocales: ["ms-MY"],
    correlationId: "correlation-content-integration-001",
    campaignId: "campaign-content-integration-001",
    templateReferences: { product: "template-product-001", seo: "template-seo-001" },
    customMetadata: {
      fixture: "complete-beauty-product",
      brandPositioning: marketingFixture.brandPositioning,
    },
    socialInput: {
      targetAudience: { primaryAudience: marketingFixture.targetAudience, targetMarket: "US" },
      customerPersona: marketingFixture.customerPersona,
      customerSegment: marketingFixture.customerSegment,
      valueProposition: marketingFixture.valueProposition,
      campaignObjective: "conversion",
    },
    videoInput: {
      targetAudience: { primaryAudience: marketingFixture.targetAudience, targetMarket: "US" },
      customerPersona: marketingFixture.customerPersona,
      valueProposition: marketingFixture.valueProposition,
      campaignObjective: "conversion",
      ...(productCopy().howToUse === undefined
        ? {}
        : { usageInstructions: productCopy().howToUse }),
    },
    emailInput: {
      targetAudience: {
        primaryAudience: marketingFixture.targetAudience,
        customerSegment: marketingFixture.customerSegment,
      },
      customerPersona: marketingFixture.customerPersona,
      customerSegment: marketingFixture.customerSegment,
      valueProposition: marketingFixture.valueProposition,
      campaignObjective: "conversion",
      customerJourneyStage: "consideration",
      ...(productCopy().howToUse === undefined ? {} : { usageGuidance: productCopy().howToUse }),
    },
    emailOptions: {
      includeSequence: true,
      sequenceLength: 3,
      includePlainTextVersion: true,
      personalizationTokens: ["{{first_name}}", "{{product_name}}", "{{unsubscribe_url}}"],
    },
    blogInput: {
      targetAudience: {
        primaryAudience: marketingFixture.targetAudience,
        customerSegment: marketingFixture.customerSegment,
      },
      customerPersona: marketingFixture.customerPersona,
      customerSegment: marketingFixture.customerSegment,
      customerJourneyStage: marketingFixture.customerJourneyStage,
      marketingAngle: marketingFixture.marketingAngle,
      valueProposition: marketingFixture.valueProposition,
      campaignObjective: "education",
      verifiedResearchFacts: [
        { fact: "Soft silicone touchpoints", sourceReference: "approved product fixture" },
      ],
      sourceReferences: [
        { label: "Approved product fixture", referenceType: "product-documentation" },
      ],
    },
    blogOptions: { strictEditorialEvidenceMode: true, includeExternalSourcePlaceholders: true },
    ...overrides,
  };
}
