import type { AutoDsMoney } from "../../../autods/domain/models/autods-product.model.js";
import type { ProductCurrency } from "../../../ai-product/types/product.types.js";

export type ProductHunterSource = "autods" | "winninghunter" | "koala" | "aliexpress" | "manual";

export interface ProductCandidate {
  readonly source: ProductHunterSource;
  readonly sourceProductId: string;
  readonly title: string;
  readonly productUrl: string;
  readonly imageUrl: string;
  readonly supplierPrice: number;
  readonly shippingCost: number;
  readonly suggestedSellingPrice: number;
  readonly currency: ProductCurrency;
  readonly estimatedDeliveryDays: number;
  readonly supplierRating: number;
  readonly salesOrOrders: number;
  readonly reviewCount: number;
  readonly trendScore: number;
  readonly competitionScore: number;
}

export interface ProductCandidateMoney {
  readonly amount: AutoDsMoney["amount"];
  readonly currency: AutoDsMoney["currency"];
}

export interface ProductCandidateFinancials {
  readonly supplierPrice: ProductCandidateMoney;
  readonly shippingCost: ProductCandidateMoney;
  readonly suggestedSellingPrice: ProductCandidateMoney;
  readonly totalCost: ProductCandidateMoney;
  readonly estimatedProfit: ProductCandidateMoney;
  readonly profitMarginPercentage: number;
}

export interface ProductCandidateScoreBreakdown {
  readonly profitMargin: number;
  readonly salesDemand: number;
  readonly supplierRating: number;
  readonly deliverySpeed: number;
  readonly trendStrength: number;
  readonly competitionOpportunity: number;
}

export interface ScoredProductCandidate {
  readonly candidate: ProductCandidate;
  readonly financials: ProductCandidateFinancials;
  readonly scoreBreakdown: ProductCandidateScoreBreakdown;
  readonly winningScore: number;
}
