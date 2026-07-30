import type { StorefrontPlan, StorefrontQualityReport, StorefrontValidationReport } from "../../domain/index.js";

export interface StorefrontPlanningScore {
  readonly overall: number;
  readonly homepage: number;
  readonly navigation: number;
  readonly productCoverage: number;
  readonly collectionCoverage: number;
  readonly contentCompleteness: number;
  readonly brandCompleteness: number;
}

export class PlanningScoreCalculator {
  public score(plan: StorefrontPlan, validation: StorefrontValidationReport): StorefrontPlanningScore {
    const homepage = Math.min(100, plan.homepage.sections.length * 7);
    const navigation = validation.warnings.some((warning) => warning.code === "INVALID_MENU") ? 70 : 95;
    const productCoverage = plan.productPages.length === 0 ? 25 : Math.min(100, plan.productPages.length * 25);
    const collectionCoverage = plan.collections.length === 0 ? 25 : Math.min(100, plan.collections.length * 20);
    const contentCompleteness = Math.min(100, plan.productPages.reduce((sum, page) => sum + page.blocks.length, 0) * 3 + plan.homepage.sections.length * 3);
    const brandCompleteness = [
      plan.profile.brandName,
      plan.profile.brandPositioning,
      plan.profile.industry,
      plan.profile.currency,
      ...plan.profile.visualIdentity,
      ...plan.profile.trustStyle,
    ].filter((value) => value.trim().length > 0).length >= 8 ? 95 : 70;
    const safetyPenalty = validation.errors.length * 20 + validation.warnings.length * 3;
    const rawOverall = Math.round((homepage + navigation + productCoverage + collectionCoverage + contentCompleteness + brandCompleteness) / 6) - safetyPenalty;

    return {
      overall: clamp(rawOverall),
      homepage: clamp(homepage),
      navigation: clamp(navigation),
      productCoverage: clamp(productCoverage),
      collectionCoverage: clamp(collectionCoverage),
      contentCompleteness: clamp(contentCompleteness),
      brandCompleteness: clamp(brandCompleteness),
    };
  }

  public toQualityReport(score: StorefrontPlanningScore, validation: StorefrontValidationReport): StorefrontQualityReport {
    return {
      overallScore: score.overall,
      categoryScores: {
        homepage: score.homepage,
        navigation: score.navigation,
        productCoverage: score.productCoverage,
        collectionCoverage: score.collectionCoverage,
        contentCompleteness: score.contentCompleteness,
        brandCompleteness: score.brandCompleteness,
      },
      errors: validation.errors.map((issue) => issue.message),
      warnings: validation.warnings.map((issue) => issue.message),
      recommendations: ["Review the deterministic storefront plan before any future artifact generation."],
      requiresHumanReview: true,
      renderedVisualQuality: "UNKNOWN",
    };
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
