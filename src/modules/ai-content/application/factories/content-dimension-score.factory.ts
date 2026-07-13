import type {
  ContentDimensionScore,
  ContentQualityDimension,
  ContentQualityRuleEvaluation,
} from "../dto/content-quality-scoring.types.js";
import { InvalidDimensionScoreError } from "../errors/product-content.errors.js";
import { CONTENT_QUALITY_DIMENSIONS } from "./content-scoring-profile.factory.js";

export class ContentDimensionScoreFactory {
  public create(
    evaluations: readonly ContentQualityRuleEvaluation[],
    weights: Readonly<Record<ContentQualityDimension, number>>,
  ): readonly ContentDimensionScore[] {
    return CONTENT_QUALITY_DIMENSIONS.map((dimension) => {
      const applicable = evaluations.filter((evaluation) => evaluation.dimension === dimension && evaluation.applicable);
      const average = applicable.length === 0 ? 80 : applicable.reduce((sum, evaluation) => sum + evaluation.score, 0) / applicable.length;
      const score = roundedScore(average);
      return {
        dimension,
        score,
        weight: weights[dimension],
        passedChecks: applicable.filter((evaluation) => evaluation.status === "pass").map((evaluation) => evaluation.ruleId),
        failedChecks: applicable.filter((evaluation) => evaluation.status === "fail").map((evaluation) => evaluation.ruleId),
        warnings: applicable.filter((evaluation) => evaluation.status === "warning").map((evaluation) => evaluation.ruleId),
        evidence: applicable.flatMap((evaluation) => evaluation.evidence).slice(0, 8),
      };
    });
  }
}

export function roundedScore(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new InvalidDimensionScoreError("Dimension score must be a finite value between 0 and 100.", { value });
  }
  return Math.round(value * 10) / 10;
}
