import type {
  ContentQualityScoringOptions,
  ContentQualityScoringOptionsInput,
  ContentScoringProfile,
} from "../dto/content-quality-scoring.types.js";
import { InvalidDimensionScoreError } from "../errors/product-content.errors.js";
import { ContentScoringProfileFactory } from "./content-scoring-profile.factory.js";

export class ContentQualityScoringOptionsFactory {
  public constructor(private readonly profileFactory = new ContentScoringProfileFactory()) {}

  public create(input: ContentQualityScoringOptionsInput = {}): ContentQualityScoringOptions {
    const scoringProfile: ContentScoringProfile = input.scoringProfile ?? "balanced";
    const strictSafetyMode = input.strictSafetyMode ?? true;
    const minimumApprovalScore = score(input.minimumApprovalScore ?? 75, "minimumApprovalScore");
    const minimumPublishScore = score(input.minimumPublishScore ?? 85, "minimumPublishScore");

    return {
      scoringProfile,
      ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
      ...(input.channel === undefined ? {} : { channel: input.channel }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.objective === undefined ? {} : { objective: input.objective }),
      strictSafetyMode,
      strictComplianceMode: input.strictComplianceMode ?? true,
      strictSEOMode: input.strictSEOMode ?? true,
      strictReadabilityMode: input.strictReadabilityMode ?? true,
      includeRecommendations: input.includeRecommendations ?? true,
      includeRevisionGuidance: input.includeRevisionGuidance ?? true,
      includeFailedRuleDetails: input.includeFailedRuleDetails ?? true,
      minimumApprovalScore,
      minimumPublishScore,
      dimensionWeights: this.profileFactory.create(scoringProfile, input.customDimensionWeights, strictSafetyMode),
      maximumRecommendationCount: clamp(input.maximumRecommendationCount ?? 8, 0, 20),
      maximumIssueCount: clamp(input.maximumIssueCount ?? 12, 1, 30),
      assignScoreToContent: input.assignScoreToContent ?? false,
    };
  }
}

function score(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new InvalidDimensionScoreError(`${field} must be between 0 and 100.`, { field, value });
  }
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
