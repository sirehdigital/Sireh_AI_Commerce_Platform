import { InvalidQualityScoreError } from "../errors/content-domain.errors.js";
import { CONTENT_VALUE_LIMITS } from "./content-value-limits.js";

export class QualityScore {
  public readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  public static create(value: number): QualityScore {
    if (!Number.isFinite(value)) {
      throw new InvalidQualityScoreError("Quality score must be finite.");
    }

    if (
      value < CONTENT_VALUE_LIMITS.qualityScoreMin ||
      value > CONTENT_VALUE_LIMITS.qualityScoreMax
    ) {
      throw new InvalidQualityScoreError("Quality score is outside the allowed range.", {
        min: CONTENT_VALUE_LIMITS.qualityScoreMin,
        max: CONTENT_VALUE_LIMITS.qualityScoreMax,
      });
    }

    return new QualityScore(value);
  }

  public equals(other: QualityScore): boolean {
    return this.value === other.value;
  }
}
