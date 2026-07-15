import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCost,
  ProductCurrency,
  ProductImage,
  ProductOption,
  ProductRiskAssessment,
  ProductScoreBreakdown,
  ProductVariant,
  RawProductInput,
  ShopifyProductPayload,
  SupplierInformation,
  TargetMarket,
} from "../../../ai-product/types/product.types.js";
import type { ProductBrandingResult } from "../../../ai-product/services/product-branding.service.js";
import type { ProductPricingRecommendation } from "../../../ai-product/services/product-pricing.service.js";
import type { ProductCopy } from "../../../ai-product/types/product.types.js";

export type ProductPreparationExecutionMode = "proposal-only";
export type ProductPreparationTagPolicy = "merge" | "exact-approved-set" | "preserve-existing";

export type ProductPreparationStepId =
  | "ValidateInput"
  | "NormalizeProduct"
  | "AnalyzeProduct"
  | "AssessProductRisk"
  | "GenerateProductBranding"
  | "GenerateProductCopy"
  | "RecommendProductPricing"
  | "MapProductForShopify"
  | "PrepareSafeUpdateProposal"
  | "RequireHumanApproval";

export type ProductPreparationSkipReason =
  | "capability-not-requested"
  | "analysis-not-executed"
  | "dependency-output-unavailable";

export interface ProductPreparationStepRecord {
  readonly id: ProductPreparationStepId;
  readonly order: number;
  readonly status: "completed";
}

export interface ProductPreparationSkippedStep {
  readonly id: ProductPreparationStepId;
  readonly reason: ProductPreparationSkipReason;
  readonly notes: readonly string[];
}

export interface ProductPreparationRequestedCapabilities {
  readonly normalize: boolean;
  readonly assessRisk: boolean;
  readonly generateBranding: boolean;
  readonly generateCopy: boolean;
  readonly recommendPricing: boolean;
  readonly mapForShopify: boolean;
  readonly prepareSafeUpdateProposal: boolean;
}

export interface ProductPreparationBrandContext {
  readonly brandName: string;
  readonly brandVoice: string;
  readonly targetMarkets: readonly TargetMarket[];
  readonly sellingCurrency: ProductCurrency;
  readonly preferredCollections: readonly string[];
  readonly templateSuffix: string;
}

export interface ProductPreparationSourceProduct {
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly title: string;
  readonly description: string;
  readonly brand: string;
  readonly category: string;
  readonly productType: string;
  readonly tags: readonly string[];
  readonly images: readonly ProductImage[];
  readonly options: readonly ProductOption[];
  readonly variants: readonly ProductVariant[];
  readonly supplier: SupplierInformation;
  readonly cost: ProductCost;
  readonly currency: ProductCurrency;
  readonly targetMarkets: readonly TargetMarket[];
}

export interface ProductPreparationAnalysisContext {
  readonly score: ProductScoreBreakdown;
  readonly riskAssessment: ProductRiskAssessment;
}

export interface ProductPreparationInventoryLocationState {
  readonly locationId: string;
  readonly locationName: string;
  readonly quantities: Readonly<Record<string, number>>;
}

export interface ProductPreparationShopifyState {
  readonly productId: string;
  readonly handle: string;
  readonly variantTitles?: readonly string[];
  readonly variantIds: readonly string[];
  readonly variantSkus: readonly string[];
  readonly inventoryItemIds: readonly string[];
  readonly inventoryTracked: boolean;
  readonly inventoryPolicies: readonly string[];
  readonly inventoryLocations: readonly ProductPreparationInventoryLocationState[];
  readonly currentStatus: string;
  readonly collectionIds?: readonly string[];
  readonly templateSuffix?: string;
  readonly storeCurrency?: ProductCurrency;
}

export interface ProductPreparationInput extends Readonly<Record<string, unknown>> {
  readonly executionMode: ProductPreparationExecutionMode;
  readonly sourceProduct: ProductPreparationSourceProduct;
  readonly brandContext: ProductPreparationBrandContext;
  readonly requestedCapabilities: ProductPreparationRequestedCapabilities;
  readonly optionalAnalysisContext?: ProductPreparationAnalysisContext;
  readonly currentShopifyState?: ProductPreparationShopifyState;
}

export interface ProductPreparationProductReference {
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly title: string;
}

export interface ProductPreparationSafeUpdateProposal {
  readonly targetStatus: "DRAFT";
  readonly title?: string;
  readonly descriptionHtml?: string;
  readonly vendor?: string;
  readonly productType?: string;
  readonly tagsToAdd: readonly string[];
  readonly approvedTags: readonly string[];
  readonly tagPolicy: ProductPreparationTagPolicy;
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly pricing?: {
    readonly currency: ProductCurrency;
    readonly price: number;
    readonly compareAtPrice: number;
  };
  readonly collectionReferences: readonly string[];
  readonly templateSuffix: string;
  readonly excludedMutations: readonly string[];
}

export interface ProductPreparationRequirement {
  readonly subject: string;
  readonly status: "required-for-future-execution";
  readonly expectedValue: unknown;
}

export interface ProductPreparationProposal extends Readonly<Record<string, unknown>> {
  readonly workflowId: string;
  readonly executionMode: ProductPreparationExecutionMode;
  readonly productReference: ProductPreparationProductReference;
  readonly completedSteps: readonly ProductPreparationStepRecord[];
  readonly skippedSteps: readonly ProductPreparationSkippedStep[];
  readonly warnings: readonly string[];
  readonly normalizedProduct?: NormalizedProduct;
  readonly riskAssessment?: ProductRiskAssessment;
  readonly analysis?: ProductAIAnalysis;
  readonly brandingProposal?: ProductBrandingResult;
  readonly copyProposal?: ProductCopy;
  readonly pricingProposal?: ProductPricingRecommendation;
  readonly shopifyMappingProposal?: ShopifyProductPayload;
  readonly safeUpdateProposal?: ProductPreparationSafeUpdateProposal;
  readonly preservationRequirements: readonly ProductPreparationRequirement[];
  readonly approvalStatus: "required";
  readonly mutationExecuted: false;
  readonly publicationExecuted: false;
  readonly readyForHumanReview: boolean;
  readonly generatedAt: string;
}

export interface ProductPreparationAdapters {
  readonly normalizer: {
    readonly normalize: (input: RawProductInput) => NormalizedProduct;
  };
  readonly analyzer: {
    readonly analyze: (
      product: NormalizedProduct,
      score: ProductScoreBreakdown,
      risk: ProductRiskAssessment,
    ) => ProductAIAnalysis;
  };
  readonly riskAssessor: {
    readonly assess: (product: NormalizedProduct) => ProductRiskAssessment;
  };
  readonly branding: {
    readonly buildBranding: (product: NormalizedProduct, analysis: ProductAIAnalysis) => ProductBrandingResult;
  };
  readonly copy: {
    readonly generate: (
      product: NormalizedProduct,
      analysis: ProductAIAnalysis,
      branding: ProductBrandingResult,
    ) => ProductCopy;
  };
  readonly pricing: {
    readonly recommend: (
      product: NormalizedProduct,
      analysis: ProductAIAnalysis,
      branding: ProductBrandingResult,
    ) => ProductPricingRecommendation;
  };
  readonly shopifyMapper: {
    readonly map: (
      product: NormalizedProduct,
      analysis: ProductAIAnalysis,
      branding: ProductBrandingResult,
      copy: ProductCopy,
      pricing: ProductPricingRecommendation,
    ) => ShopifyProductPayload;
  };
  readonly shopifyProductUpdate?: {
    readonly blocked: true;
  };
}

export class ProductPreparationWorkflowError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProductPreparationWorkflowError";
  }
}
