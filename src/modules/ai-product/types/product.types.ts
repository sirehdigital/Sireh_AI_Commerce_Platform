export type ProductSource =
  | "manual"
  | "shopify"
  | "autods"
  | "winninghunter"
  | "aliexpress"
  | "cjdropshipping"
  | "zendrop"
  | "dsers"
  | "usadrop"
  | "other";

export type ProductStatus =
  | "draft"
  | "analyzing"
  | "qualified"
  | "rejected"
  | "ready"
  | "published"
  | "archived";

export type ProductCurrency =
  | "USD"
  | "GBP"
  | "AUD"
  | "CAD"
  | "MYR"
  | "EUR"
  | (string & {});

export type TargetMarket = "US" | "UK" | "AU" | "CA" | "MY" | "EU" | "GLOBAL";

export type ProductRiskLevel = "low" | "medium" | "high" | "critical";

export type ProductWeightUnit = "g" | "kg" | "oz" | "lb";

export type ProductMarketingChannel =
  | "shopify"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "google"
  | "email"
  | "pinterest"
  | "youtube";

export type ProductRecommendation = "strong-buy" | "test" | "watch" | "reject";

export type ShopifyProductStatus = "draft" | "active" | "archived";

export type ProductMetadata = Record<string, unknown>;

export interface ProductImage {
  readonly id: string;
  readonly url: string;
  readonly altText?: string;
  readonly position?: number;
  readonly width?: number;
  readonly height?: number;
  readonly isPrimary?: boolean;
}

export interface ProductOption {
  readonly name: string;
  readonly values: readonly string[];
}

export interface ProductVariant {
  readonly id: string;
  readonly supplierVariantId?: string;
  readonly sku?: string;
  readonly title: string;
  readonly optionValues: Readonly<Record<string, string>>;
  readonly cost?: number;
  readonly suggestedPrice?: number;
  readonly compareAtPrice?: number;
  readonly currency: ProductCurrency;
  readonly inventoryQuantity?: number;
  readonly weight?: number;
  readonly weightUnit?: ProductWeightUnit;
  readonly imageUrl?: string;
  readonly available: boolean;
}

export interface ProductCost {
  readonly productCost: number;
  readonly shippingCost: number;
  readonly transactionCost: number;
  readonly advertisingCostEstimate: number;
  readonly totalLandedCost: number;
  readonly currency: ProductCurrency;
}

export interface ProductPricing {
  readonly cost: number;
  readonly sellingPrice: number;
  readonly compareAtPrice?: number;
  readonly grossProfit: number;
  readonly grossMarginPercentage: number;
  readonly markupPercentage: number;
  readonly currency: ProductCurrency;
}

export interface SupplierInformation {
  readonly source: ProductSource;
  readonly supplierName?: string;
  readonly supplierProductId?: string;
  readonly supplierProductUrl?: string;
  readonly supplierStoreUrl?: string;
  readonly shippingOrigin?: string;
  readonly estimatedDeliveryDaysMin?: number;
  readonly estimatedDeliveryDaysMax?: number;
  readonly supplierRating?: number;
  readonly orderCount?: number;
}

export interface RawProductInput {
  readonly source: ProductSource;
  readonly externalId?: string;
  readonly title: string;
  readonly description?: string;
  readonly productUrl?: string;
  readonly supplier?: SupplierInformation;
  readonly images: readonly ProductImage[];
  readonly options: readonly ProductOption[];
  readonly variants: readonly ProductVariant[];
  readonly tags: readonly string[];
  readonly category?: string;
  readonly brand?: string;
  readonly targetMarkets: readonly TargetMarket[];
  readonly metadata: ProductMetadata;
  readonly capturedAt: Date;
}

export interface NormalizedProduct {
  readonly id: string;
  readonly source: ProductSource;
  readonly externalId?: string;
  readonly status: ProductStatus;
  readonly title: string;
  readonly originalTitle?: string;
  readonly description: string;
  readonly originalDescription?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly tags: readonly string[];
  readonly targetMarkets: readonly TargetMarket[];
  readonly supplier?: SupplierInformation;
  readonly images: readonly ProductImage[];
  readonly options: readonly ProductOption[];
  readonly variants: readonly ProductVariant[];
  readonly cost?: ProductCost;
  readonly pricing?: ProductPricing;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Product scoring values are expected to be numeric scores from 0 to 100.
 */
export interface ProductScoreBreakdown {
  readonly demand: number;
  readonly competition: number;
  readonly profitability: number;
  readonly trend: number;
  readonly supplierReliability: number;
  readonly shipping: number;
  readonly marketingPotential: number;
  readonly brandability: number;
  readonly overall: number;
}

export interface ProductRiskAssessment {
  readonly level: ProductRiskLevel;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly intellectualPropertyRisk: number;
  readonly restrictedProductRisk: number;
  readonly supplierRisk: number;
  readonly shippingRisk: number;
  readonly refundRisk: number;
}

export interface ProductAudienceProfile {
  readonly primaryAudience: string;
  readonly ageRanges: readonly string[];
  readonly customerProblems: readonly string[];
  readonly customerDesires: readonly string[];
  readonly purchaseMotivations: readonly string[];
  readonly objections: readonly string[];
  readonly recommendedMarkets: readonly TargetMarket[];
}

export interface ProductMarketingAngle {
  readonly title: string;
  readonly hook: string;
  readonly coreBenefit: string;
  readonly emotionalOutcome: string;
  readonly targetAudience: string;
  readonly channels: readonly ProductMarketingChannel[];
  readonly confidenceScore: number;
}

export interface ProductAIAnalysis {
  readonly summary: string;
  readonly keyBenefits: readonly string[];
  readonly keyFeatures: readonly string[];
  readonly audience: ProductAudienceProfile;
  readonly marketingAngles: readonly ProductMarketingAngle[];
  readonly score: ProductScoreBreakdown;
  readonly risks: ProductRiskAssessment;
  readonly recommendedSellingPrice?: number;
  readonly recommendedCompareAtPrice?: number;
  readonly recommendation: ProductRecommendation;
  readonly reasoning: string;
  readonly analyzedAt: Date;
  readonly model: string;
}

export interface ProductFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface ProductCopy {
  readonly brandedTitle: string;
  readonly subtitle?: string;
  readonly shortDescription: string;
  readonly fullDescription: string;
  readonly benefits: readonly string[];
  readonly featureHighlights: readonly string[];
  readonly howToUse?: readonly string[];
  readonly faq: readonly ProductFaqItem[];
  readonly callToAction: string;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly seoKeywords: readonly string[];
}

export interface AIProductRecord {
  readonly normalizedProduct: NormalizedProduct;
  readonly aiAnalysis?: ProductAIAnalysis;
  readonly generatedCopy?: ProductCopy;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ShopifyProductPayloadImage {
  readonly src: string;
  readonly altText?: string;
  readonly position?: number;
}

export interface ShopifyProductPayloadOption {
  readonly name: string;
  readonly values: readonly string[];
}

export interface ShopifyProductPayloadVariant {
  readonly sku?: string;
  readonly title?: string;
  readonly optionValues: Readonly<Record<string, string>>;
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly inventoryQuantity?: number;
  readonly weight?: number;
  readonly weightUnit?: ProductWeightUnit;
}

export interface ShopifyProductPayloadSeo {
  readonly title?: string;
  readonly description?: string;
}

export interface ShopifyProductPayload {
  readonly title: string;
  readonly descriptionHtml: string;
  readonly vendor?: string;
  readonly productType?: string;
  readonly tags: readonly string[];
  readonly status: ShopifyProductStatus;
  readonly images: readonly ShopifyProductPayloadImage[];
  readonly options: readonly ShopifyProductPayloadOption[];
  readonly variants: readonly ShopifyProductPayloadVariant[];
  readonly seo?: ShopifyProductPayloadSeo;
}
