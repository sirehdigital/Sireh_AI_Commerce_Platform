import type { ProductMediaPlan } from "../../domain/models/index.js";

export interface ProductMediaSafetyValidationResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly blockedReasons: readonly string[];
  readonly requiresHumanReview: boolean;
}

const BLOCKED_PATTERNS = [
  { pattern: /clinically proven|cure|treat|heal|medical|dermatologist approved/iu, reason: "Unsupported health or medical claim." },
  { pattern: /before\s*\/?\s*after|before and after/iu, reason: "Before/after imagery is not supported." },
  { pattern: /third[- ]party logo|nike|apple|disney|gucci/iu, reason: "Third-party logo or trademark risk." },
] as const;

export class ProductMediaSafetyValidator {
  public validate(plan: ProductMediaPlan): ProductMediaSafetyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const blockedReasons: string[] = [];

    if (plan.assets.length > 24) {
      errors.push("Media plan requests too many assets.");
    }

    for (const source of plan.sourceMedia) {
      if (!/^https:\/\//iu.test(source.originalUrl)) {
        errors.push(`Source ${source.sourceAssetId} uses an unsafe URL scheme.`);
      }
    }

    for (const asset of plan.assets) {
      const searchable = `${asset.prompt.prompt} ${asset.altText}`;
      for (const rule of BLOCKED_PATTERNS) {
        if (rule.pattern.test(searchable)) {
          blockedReasons.push(`${asset.assetType}: ${rule.reason}`);
        }
      }

      if (asset.specification.sourceAssetIds.length === 0 && asset.prompt.sourceImageRequired) {
        errors.push(`${asset.assetType} is missing required source references.`);
      }

      if (asset.specification.width <= 0 || asset.specification.height <= 0) {
        errors.push(`${asset.assetType} has malformed dimensions.`);
      }
    }

    if (plan.sourceMedia.some((source) => source.licenseStatus === "unknown")) {
      warnings.push("One or more source media references have unknown usage rights.");
    }

    return {
      errors,
      warnings,
      blockedReasons,
      requiresHumanReview: true,
    };
  }
}
