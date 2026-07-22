import type { ProductMediaPlan, ProductMediaQualityReport } from "../../domain/models/index.js";

export class ProductMediaQualityEvaluator {
  public evaluatePlan(plan: Omit<ProductMediaPlan, "qualityReport">): ProductMediaQualityReport {
    const errors: string[] = [];
    const warnings: string[] = [...plan.warnings];

    if (plan.assets.length === 0) {
      errors.push("Media plan must include at least one asset.");
    }

    for (const asset of plan.assets) {
      if (asset.specification.width <= 0 || asset.specification.height <= 0) {
        errors.push(`${asset.assetType} has malformed dimensions.`);
      }

      if (asset.altText.trim().length === 0) {
        errors.push(`${asset.assetType} is missing alt text.`);
      }

      if (!asset.prompt.prompt.includes(asset.specification.aspectRatio)) {
        warnings.push(`${asset.assetType} prompt should include aspect-ratio guidance.`);
      }

      if (asset.prompt.constraints.length < 5) {
        warnings.push(`${asset.assetType} prompt has weak identity constraints.`);
      }
    }

    const score = Math.max(0, Math.min(100, 100 - errors.length * 25 - warnings.length * 3));

    return {
      score,
      errors,
      warnings,
      requiresHumanReview: true,
      visualQuality: "UNKNOWN",
    };
  }
}
