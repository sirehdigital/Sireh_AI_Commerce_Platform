import type {
  NormalizedProduct,
  ProductRiskAssessment,
  ProductRiskLevel,
  ProductVariant,
  SupplierInformation,
} from "../types/product.types.js";

type RiskDimension =
  | "intellectualPropertyRisk"
  | "restrictedProductRisk"
  | "supplierRisk"
  | "shippingRisk"
  | "refundRisk";

interface RiskKeyword {
  readonly term: string;
  readonly weight: number;
}

interface RiskReason {
  readonly dimension: RiskDimension;
  readonly message: string;
  readonly severity: number;
}

const RISK_WEIGHTS: Readonly<Record<RiskDimension, number>> = {
  intellectualPropertyRisk: 0.25,
  restrictedProductRisk: 0.25,
  supplierRisk: 0.2,
  shippingRisk: 0.15,
  refundRisk: 0.15,
};

const IP_RISK_KEYWORDS: readonly RiskKeyword[] = [
  { term: "counterfeit", weight: 45 },
  { term: "fake", weight: 40 },
  { term: "replica", weight: 40 },
  { term: "knockoff", weight: 35 },
  { term: "mirror quality", weight: 32 },
  { term: "1:1", weight: 30 },
  { term: "unofficial", weight: 26 },
  { term: "imitation", weight: 24 },
  { term: "dupe", weight: 22 },
  { term: "copy", weight: 18 },
  { term: "inspired by", weight: 16 },
];

const RESTRICTED_RISK_KEYWORDS: readonly RiskKeyword[] = [
  { term: "firearm", weight: 55 },
  { term: "ammunition", weight: 55 },
  { term: "explosive", weight: 55 },
  { term: "thc", weight: 50 },
  { term: "prescription", weight: 48 },
  { term: "medical-grade drug", weight: 48 },
  { term: "guaranteed weight loss", weight: 45 },
  { term: "treats disease", weight: 45 },
  { term: "cures", weight: 42 },
  { term: "controlled substance", weight: 42 },
  { term: "recreational drug", weight: 42 },
  { term: "tobacco", weight: 40 },
  { term: "nicotine", weight: 40 },
  { term: "vape", weight: 40 },
  { term: "alcohol", weight: 36 },
  { term: "pesticide", weight: 36 },
  { term: "hazardous chemical", weight: 36 },
  { term: "adult toy", weight: 34 },
  { term: "gambling", weight: 34 },
  { term: "spyware", weight: 34 },
  { term: "surveillance camera hidden", weight: 32 },
  { term: "knife", weight: 28 },
  { term: "tactical weapon", weight: 28 },
  { term: "fireworks", weight: 28 },
  { term: "radioactive", weight: 28 },
  { term: "counterfeit", weight: 28 },
];

const GENERIC_TITLES = new Set([
  "product",
  "item",
  "new product",
  "best product",
  "untitled product",
]);

/**
 * Provides deterministic, rule-based product risk screening from structured product data.
 */
export class ProductRiskAssessmentService {
  /**
   * Assesses product risk without external lookups, AI calls, or provider-specific assumptions.
   */
  public assess(product: NormalizedProduct): ProductRiskAssessment {
    const text = this.aggregateProductText(product);
    const intellectualPropertyRisk = this.assessIntellectualPropertyRisk(text);
    const restrictedProductRisk = this.assessRestrictedProductRisk(text);
    const supplierRisk = this.assessSupplierRisk(product);
    const shippingRisk = this.assessShippingRisk(product);
    const refundRisk = this.assessRefundRisk(product);
    const score = this.calculateOverallRisk({
      intellectualPropertyRisk,
      restrictedProductRisk,
      supplierRisk,
      shippingRisk,
      refundRisk,
    });

    return {
      level: this.resolveRiskLevel(score),
      score,
      reasons: this.buildReasons(product, {
        intellectualPropertyRisk,
        restrictedProductRisk,
        supplierRisk,
        shippingRisk,
        refundRisk,
      }),
      intellectualPropertyRisk,
      restrictedProductRisk,
      supplierRisk,
      shippingRisk,
      refundRisk,
    };
  }

  private assessIntellectualPropertyRisk(text: string): number {
    return this.clampRisk(this.weightedKeywordRisk(text, IP_RISK_KEYWORDS));
  }

  private assessRestrictedProductRisk(text: string): number {
    return this.clampRisk(this.weightedKeywordRisk(text, RESTRICTED_RISK_KEYWORDS));
  }

  private assessSupplierRisk(product: NormalizedProduct): number {
    const supplier = product.supplier;
    const variants = product.variants;
    let risk = 20;

    if (supplier === undefined) {
      risk += 30;
    } else {
      risk += this.hasText(supplier.supplierName) ? 0 : 12;
      risk += this.hasText(supplier.supplierProductId) ? 0 : 8;
      risk += this.hasText(supplier.supplierProductUrl) ? 0 : 12;
      risk += this.hasText(supplier.supplierStoreUrl) ? 0 : 6;
      risk += this.supplierRatingRisk(supplier.supplierRating);
      risk += this.orderCountRisk(supplier.orderCount);
      risk += this.deliveryWindowRisk(supplier.estimatedDeliveryDaysMin, supplier.estimatedDeliveryDaysMax) * 0.35;
    }

    if (variants.length === 0) {
      risk += 22;
    } else if (variants.every((variant) => !variant.available)) {
      risk += 18;
    }

    return this.clampRisk(risk);
  }

  private assessShippingRisk(product: NormalizedProduct): number {
    const supplier = product.supplier;
    const variants = product.variants;
    let risk = 20;

    if (supplier === undefined) {
      risk += 18;
    } else {
      risk += this.deliveryWindowRisk(
        supplier.estimatedDeliveryDaysMin,
        supplier.estimatedDeliveryDaysMax,
      );
      risk += this.hasText(supplier.shippingOrigin) ? 0 : 10;
    }

    risk += this.shippingCostRisk(product);
    risk += this.variantWeightRisk(variants, product.targetMarkets.length);

    if (variants.length === 0 || variants.every((variant) => !variant.available)) {
      risk += 16;
    }

    return this.clampRisk(risk);
  }

  private assessRefundRisk(product: NormalizedProduct): number {
    let risk = 18;

    risk += product.description.trim().length >= 120 ? 0 : 14;
    risk += product.images.length > 0 ? 0 : 16;
    risk += this.isGenericTitle(product.title) ? 12 : 0;
    risk += product.variants.some((variant) => variant.available) ? 0 : 16;
    risk += product.options.length > 0 ? 0 : 6;
    risk += this.isUsableCategory(product.category) ? 0 : 8;
    risk += this.pricingRisk(product);
    risk += this.supplierRatingRisk(product.supplier?.supplierRating) * 0.5;
    risk += this.deliveryWindowRisk(
      product.supplier?.estimatedDeliveryDaysMin,
      product.supplier?.estimatedDeliveryDaysMax,
    ) * 0.3;
    risk += this.missingWeightRisk(product.variants);

    return this.clampRisk(risk);
  }

  private aggregateProductText(product: NormalizedProduct): string {
    return [
      product.title,
      product.originalTitle,
      product.description,
      product.originalDescription,
      product.brand,
      product.category,
      product.productType,
      ...product.tags,
    ]
      .filter((value): value is string => this.hasText(value))
      .join(" ")
      .toLowerCase()
      .replace(/\s+/gu, " ")
      .trim();
  }

  private buildReasons(
    product: NormalizedProduct,
    risks: Readonly<Record<RiskDimension, number>>,
  ): readonly string[] {
    const text = this.aggregateProductText(product);
    const reasons: RiskReason[] = [
      ...this.keywordReasons(text, IP_RISK_KEYWORDS, "intellectualPropertyRisk"),
      ...this.keywordReasons(text, RESTRICTED_RISK_KEYWORDS, "restrictedProductRisk"),
      ...this.supplierReasons(product.supplier, product.variants),
      ...this.shippingReasons(product),
      ...this.refundReasons(product),
    ];

    const materialReasons = reasons
      .filter((reason) => risks[reason.dimension] >= 35 || reason.severity >= 20)
      .sort((left, right) => right.severity - left.severity);

    const uniqueReasons = this.uniqueMessages(materialReasons.map((reason) => reason.message));

    return uniqueReasons.length > 0
      ? uniqueReasons
      : ["No significant risk indicators were detected from the available product data."];
  }

  private calculateOverallRisk(risks: Readonly<Record<RiskDimension, number>>): number {
    return this.clampRisk(
      risks.intellectualPropertyRisk * RISK_WEIGHTS.intellectualPropertyRisk +
        risks.restrictedProductRisk * RISK_WEIGHTS.restrictedProductRisk +
        risks.supplierRisk * RISK_WEIGHTS.supplierRisk +
        risks.shippingRisk * RISK_WEIGHTS.shippingRisk +
        risks.refundRisk * RISK_WEIGHTS.refundRisk,
    );
  }

  private resolveRiskLevel(score: number): ProductRiskLevel {
    if (score >= 75) {
      return "critical";
    }

    if (score >= 50) {
      return "high";
    }

    if (score >= 25) {
      return "medium";
    }

    return "low";
  }

  private weightedKeywordRisk(text: string, keywords: readonly RiskKeyword[]): number {
    const total = keywords.reduce((sum, keyword) => {
      return this.containsTerm(text, keyword.term) ? sum + keyword.weight : sum;
    }, 0);

    return Math.min(100, total);
  }

  private keywordReasons(
    text: string,
    keywords: readonly RiskKeyword[],
    dimension: RiskDimension,
  ): readonly RiskReason[] {
    const matched = keywords
      .filter((keyword) => this.containsTerm(text, keyword.term))
      .sort((left, right) => right.weight - left.weight);

    if (matched.length === 0) {
      return [];
    }

    const strongest = matched[0];
    const message =
      dimension === "intellectualPropertyRisk"
        ? "Product text contains wording commonly associated with replica or imitation goods."
        : "Product text contains wording commonly associated with restricted or enhanced-review products.";

    return [
      {
        dimension,
        message,
        severity: strongest?.weight ?? 0,
      },
    ];
  }

  private supplierReasons(
    supplier: SupplierInformation | undefined,
    variants: readonly ProductVariant[],
  ): readonly RiskReason[] {
    const reasons: RiskReason[] = [];

    if (supplier === undefined) {
      reasons.push({
        dimension: "supplierRisk",
        message: "Supplier information is missing.",
        severity: 30,
      });
    } else {
      if (!this.hasText(supplier.supplierName)) {
        reasons.push({
          dimension: "supplierRisk",
          message: "Supplier name is missing.",
          severity: 16,
        });
      }

      if (!this.hasText(supplier.supplierProductUrl)) {
        reasons.push({
          dimension: "supplierRisk",
          message: "Supplier product URL is missing.",
          severity: 16,
        });
      }

      if (this.safeNonNegativeNumber(supplier.supplierRating) === undefined) {
        reasons.push({
          dimension: "supplierRisk",
          message: "Supplier rating is missing.",
          severity: 14,
        });
      } else if (this.supplierRatingRisk(supplier.supplierRating) >= 25) {
        reasons.push({
          dimension: "supplierRisk",
          message: "Supplier rating indicates elevated supplier risk.",
          severity: 24,
        });
      }

      if (this.safeNonNegativeNumber(supplier.orderCount) === undefined) {
        reasons.push({
          dimension: "supplierRisk",
          message: "Supplier order count is missing.",
          severity: 12,
        });
      }
    }

    if (variants.length === 0 || variants.every((variant) => !variant.available)) {
      reasons.push({
        dimension: "supplierRisk",
        message: "No available product variants are present.",
        severity: 24,
      });
    }

    return reasons;
  }

  private shippingReasons(product: NormalizedProduct): readonly RiskReason[] {
    const reasons: RiskReason[] = [];
    const supplier = product.supplier;

    if (supplier === undefined) {
      return [
        {
          dimension: "shippingRisk",
          message: "Shipping information is missing.",
          severity: 18,
        },
      ];
    }

    const deliveryRisk = this.deliveryWindowRisk(
      supplier.estimatedDeliveryDaysMin,
      supplier.estimatedDeliveryDaysMax,
    );

    if (deliveryRisk >= 35) {
      reasons.push({
        dimension: "shippingRisk",
        message: "Estimated delivery duration is elevated.",
        severity: deliveryRisk,
      });
    }

    const minDays = this.safeNonNegativeNumber(supplier.estimatedDeliveryDaysMin);
    const maxDays = this.safeNonNegativeNumber(supplier.estimatedDeliveryDaysMax);
    if (minDays !== undefined && maxDays !== undefined && minDays > maxDays) {
      reasons.push({
        dimension: "shippingRisk",
        message: "Estimated delivery range is inconsistent.",
        severity: 28,
      });
    }

    if (!this.hasText(supplier.shippingOrigin)) {
      reasons.push({
        dimension: "shippingRisk",
        message: "Shipping origin is missing.",
        severity: 14,
      });
    }

    if (this.shippingCostRisk(product) >= 25) {
      reasons.push({
        dimension: "shippingRisk",
        message: "Shipping cost is high relative to product cost.",
        severity: 25,
      });
    }

    return reasons;
  }

  private refundReasons(product: NormalizedProduct): readonly RiskReason[] {
    const reasons: RiskReason[] = [];

    if (product.description.trim().length < 120) {
      reasons.push({
        dimension: "refundRisk",
        message: "Product description is limited.",
        severity: 16,
      });
    }

    if (product.images.length === 0) {
      reasons.push({
        dimension: "refundRisk",
        message: "No valid product images are available.",
        severity: 22,
      });
    }

    if (this.isGenericTitle(product.title)) {
      reasons.push({
        dimension: "refundRisk",
        message: "Product title is too generic for confident merchandising.",
        severity: 16,
      });
    }

    if (this.pricingRisk(product) >= 25) {
      reasons.push({
        dimension: "refundRisk",
        message: "Pricing data is missing or commercially inconsistent.",
        severity: 25,
      });
    }

    return reasons;
  }

  private supplierRatingRisk(rating: number | undefined): number {
    const value = this.safeNonNegativeNumber(rating);

    if (value === undefined) {
      return 16;
    }

    const normalized = value <= 5 ? (value / 5) * 100 : value;

    if (normalized >= 90) {
      return 0;
    }

    if (normalized >= 75) {
      return 8;
    }

    if (normalized >= 60) {
      return 18;
    }

    if (normalized >= 40) {
      return 32;
    }

    return 45;
  }

  private orderCountRisk(orderCount: number | undefined): number {
    const value = this.safeNonNegativeNumber(orderCount);

    if (value === undefined) {
      return 12;
    }

    if (value >= 1_000) {
      return 0;
    }

    if (value >= 100) {
      return 6;
    }

    if (value > 0) {
      return 14;
    }

    return 22;
  }

  private deliveryWindowRisk(minDays: number | undefined, maxDays: number | undefined): number {
    const min = this.safeNonNegativeNumber(minDays);
    const max = this.safeNonNegativeNumber(maxDays);

    if (min === undefined && max === undefined) {
      return 18;
    }

    if (min !== undefined && max !== undefined && min > max) {
      return 35;
    }

    const deliveryDays = max ?? min ?? 0;

    if (deliveryDays <= 7) {
      return 0;
    }

    if (deliveryDays <= 14) {
      return 10;
    }

    if (deliveryDays <= 21) {
      return 22;
    }

    if (deliveryDays <= 30) {
      return 38;
    }

    return 55;
  }

  private shippingCostRisk(product: NormalizedProduct): number {
    const cost = product.cost;

    if (cost === undefined) {
      return 10;
    }

    if (cost.shippingCost <= 0) {
      return 0;
    }

    if (cost.productCost <= 0) {
      return 18;
    }

    const ratio = cost.shippingCost / cost.productCost;

    if (!Number.isFinite(ratio)) {
      return 18;
    }

    if (ratio <= 0.15) {
      return 0;
    }

    if (ratio <= 0.35) {
      return 12;
    }

    if (ratio <= 0.6) {
      return 25;
    }

    return 40;
  }

  private variantWeightRisk(variants: readonly ProductVariant[], targetMarketCount: number): number {
    if (variants.length === 0) {
      return 16;
    }

    const weightedVariants = variants.filter((variant) => {
      const weight = this.safeNonNegativeNumber(variant.weight);
      return weight !== undefined && weight > 0;
    });

    if (weightedVariants.length === 0) {
      return 10;
    }

    const heavyVariantExists = weightedVariants.some((variant) => {
      const grams = this.toGrams(variant.weight, variant.weightUnit);
      return grams !== undefined && grams >= 3_000;
    });

    return heavyVariantExists && targetMarketCount >= 3 ? 24 : 0;
  }

  private missingWeightRisk(variants: readonly ProductVariant[]): number {
    if (variants.length === 0) {
      return 8;
    }

    const missingWeightCount = variants.filter((variant) => {
      return this.safeNonNegativeNumber(variant.weight) === undefined;
    }).length;

    return missingWeightCount / variants.length >= 0.5 ? 8 : 0;
  }

  private pricingRisk(product: NormalizedProduct): number {
    const pricing = product.pricing;

    if (pricing === undefined || pricing.sellingPrice <= 0) {
      return 35;
    }

    let risk = 0;

    if (product.cost !== undefined && pricing.sellingPrice <= product.cost.totalLandedCost) {
      risk += 35;
    }

    if (pricing.compareAtPrice !== undefined && pricing.compareAtPrice < pricing.sellingPrice) {
      risk += 18;
    }

    return risk;
  }

  private toGrams(weight: number | undefined, unit: ProductVariant["weightUnit"]): number | undefined {
    const value = this.safeNonNegativeNumber(weight);

    if (value === undefined) {
      return undefined;
    }

    if (unit === "kg") {
      return value * 1_000;
    }

    if (unit === "lb") {
      return value * 453.59237;
    }

    if (unit === "oz") {
      return value * 28.349523125;
    }

    return value;
  }

  private containsTerm(text: string, term: string): boolean {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(^|\\W)${escapedTerm}(\\W|$)`, "u").test(text);
  }

  private isGenericTitle(title: string | undefined): boolean {
    if (!this.hasText(title)) {
      return true;
    }

    return GENERIC_TITLES.has(title.trim().toLowerCase().replace(/\s+/gu, " "));
  }

  private isUsableCategory(category: string | undefined): boolean {
    return this.hasText(category) && category.trim().toLowerCase() !== "uncategorized";
  }

  private uniqueMessages(messages: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const message of messages) {
      if (!seen.has(message)) {
        seen.add(message);
        unique.push(message);
      }
    }

    return unique;
  }

  private clampRisk(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const clamped = Math.min(100, Math.max(0, value));
    return Math.round(clamped * 100) / 100;
  }

  private safeNonNegativeNumber(value: number | undefined): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }

    return value;
  }

  private hasText(value: string | undefined): value is string {
    return value !== undefined && value.trim().length > 0;
  }
}
