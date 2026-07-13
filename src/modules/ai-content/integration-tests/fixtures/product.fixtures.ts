import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductRiskAssessment,
} from "../../../ai-product/types/product.types.js";

const FIXED_DATE = new Date("2026-07-13T00:00:00.000Z");

export function completeBeautyProduct(): NormalizedProduct {
  return {
    id: "product-integration-001",
    source: "manual",
    status: "qualified",
    title: "Lumora Daily Cleansing Brush",
    description: "A silicone cleansing brush designed for a simple daily face-care routine.",
    brand: "Lumora",
    category: "Beauty Care",
    productType: "Facial Cleansing Brush",
    tags: ["beauty", "skincare", "daily-routine"],
    targetMarkets: ["US", "UK", "AU", "CA", "MY"],
    images: [
      {
        id: "image-001",
        url: "https://example.test/lumora-brush.jpg",
        altText: "Lumora cleansing brush",
      },
    ],
    options: [{ name: "Color", values: ["Rose", "White"] }],
    variants: [
      {
        id: "variant-001",
        sku: "LUM-BRUSH-ROSE",
        title: "Rose",
        optionValues: { Color: "Rose" },
        cost: 8,
        suggestedPrice: 24,
        compareAtPrice: 29,
        currency: "USD",
        available: true,
      },
    ],
    supplier: {
      source: "manual",
      supplierName: "Verified Fixture Supplier",
      shippingOrigin: "MY",
      estimatedDeliveryDaysMin: 6,
      estimatedDeliveryDaysMax: 12,
      supplierRating: 4.7,
    },
    pricing: {
      cost: 8,
      sellingPrice: 24,
      compareAtPrice: 29,
      grossProfit: 16,
      grossMarginPercentage: 66.67,
      markupPercentage: 200,
      currency: "USD",
    },
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  };
}

export function minimalProduct(): NormalizedProduct {
  return {
    id: "product-minimal-001",
    source: "manual",
    status: "draft",
    title: "Simple Storage Box",
    description: "A storage box for household organization.",
    tags: [],
    targetMarkets: ["US"],
    images: [],
    options: [],
    variants: [],
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  };
}

export function productAnalysis(): ProductAIAnalysis {
  const risk = productRisk();
  return {
    summary:
      "The product has clear features, practical usage guidance and test-ready commercial positioning.",
    keyBenefits: ["Supports a simple daily cleansing routine", "Two color variants are available"],
    keyFeatures: ["Soft silicone touchpoints", "Compact daily-use format"],
    audience: {
      primaryAudience: "beauty enthusiasts",
      ageRanges: [],
      customerProblems: ["finding a simple cleansing tool"],
      customerDesires: ["an easy daily routine"],
      purchaseMotivations: ["clear product utility"],
      objections: ["delivery timing"],
      recommendedMarkets: ["US", "UK", "AU", "CA", "MY"],
    },
    marketingAngles: [
      {
        title: "Simple Daily Routine",
        hook: "Keep daily cleansing straightforward",
        coreBenefit: "Designed for repeat routine use",
        emotionalOutcome: "Feel prepared for a consistent routine",
        targetAudience: "beauty enthusiasts",
        channels: ["shopify", "instagram", "email"],
        confidenceScore: 86,
      },
    ],
    score: {
      demand: 78,
      competition: 65,
      profitability: 82,
      trend: 70,
      supplierReliability: 84,
      shipping: 72,
      marketingPotential: 88,
      brandability: 86,
      overall: 81,
    },
    risks: risk,
    recommendedSellingPrice: 24,
    recommendedCompareAtPrice: 29,
    recommendation: "test",
    reasoning: "Strong margin and supplier detail support a controlled commercial test.",
    analyzedAt: FIXED_DATE,
    model: "SACP Rule Engine v1",
  };
}

export function productRisk(): ProductRiskAssessment {
  return {
    level: "medium",
    score: 32,
    reasons: ["Delivery timing should be communicated clearly"],
    intellectualPropertyRisk: 5,
    restrictedProductRisk: 5,
    supplierRisk: 25,
    shippingRisk: 35,
    refundRisk: 20,
  };
}

export function productCopy(): ProductCopy {
  return {
    brandedTitle: "Lumora Daily Cleansing Brush",
    subtitle: "A practical addition to a simple daily routine",
    shortDescription: "A soft silicone cleansing brush for everyday face-care routines.",
    fullDescription:
      "The Lumora Daily Cleansing Brush combines soft silicone touchpoints with a compact format for simple everyday use.",
    benefits: ["Supports a simple cleansing routine", "Easy to handle and store"],
    featureHighlights: ["Soft silicone touchpoints", "Rose and white variants"],
    howToUse: ["Use with an appropriate cleanser", "Rinse after use", "Allow to dry"],
    faq: [
      { question: "How should it be cleaned?", answer: "Rinse after use and allow it to dry." },
    ],
    callToAction: "View product",
    seoTitle: "Lumora Daily Cleansing Brush",
    seoDescription:
      "Explore the Lumora silicone cleansing brush for a simple daily face-care routine.",
    seoKeywords: ["daily cleansing brush", "silicone face brush"],
  };
}

export const failureFixtures = {
  unsafeClaim: "Guaranteed medical treatment with instant results",
  missingContext: "",
  invalidLocale: "fr-FR",
  invalidPersonalizationToken: "{{secret_token}}",
  fabricatedEvidence: "Nine out of ten experts recommend this product.",
  invalidSEOMetadata: "x".repeat(300),
} as const;
