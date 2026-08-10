import type { CreativeAnalysisDimension } from "./creative-analysis.model.js";
import type { CreativePlatform } from "./creative-intelligence.model.js";
import type { PolicyRiskCategory, PolicyRiskSeverity } from "./creative-policy-risk.model.js";

export const CREATIVE_RECOMMENDATION_CATEGORIES = [
  "IMPROVE_HOOK",
  "IMPROVE_HEADLINE",
  "IMPROVE_PRIMARY_TEXT",
  "IMPROVE_CTA",
  "IMPROVE_VISUAL_CONCEPT",
  "IMPROVE_BRAND_CONSISTENCY",
  "PLATFORM_ADAPTATION",
  "POLICY_RISK_REVIEW",
  "HUMAN_REVIEW_REQUIRED",
] as const;

export type CreativeRecommendationCategory = (typeof CREATIVE_RECOMMENDATION_CATEGORIES)[number];

export const CREATIVE_RECOMMENDATION_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type CreativeRecommendationPriority = (typeof CREATIVE_RECOMMENDATION_PRIORITIES)[number];

export interface CreativeRecommendation {
  readonly code: string;
  readonly category: CreativeRecommendationCategory;
  readonly priority: CreativeRecommendationPriority;
  readonly dimension?: CreativeAnalysisDimension;
  readonly platform?: CreativePlatform;
  readonly riskCategory?: PolicyRiskCategory;
  readonly riskSeverity?: PolicyRiskSeverity;
  readonly reason: string;
  readonly recommendedAction: string;
  readonly evidence: readonly string[];
  readonly advisoryOnly: true;
}
