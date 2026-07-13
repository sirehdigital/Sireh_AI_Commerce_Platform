import { ContentScoreFactory } from "../../domain/factories/content-score.factory.js";
import type {
  ContentDimensionScore,
  ContentQualityScorecard,
  ContentQualityScoringInput,
  ContentQualityScoringOptions,
  ContentQualityRuleEvaluation,
} from "../dto/content-quality-scoring.types.js";
import { roundedScore } from "./content-dimension-score.factory.js";
import { ContentRecommendationFactory, ContentRevisionGuidanceFactory } from "./content-recommendation.factory.js";

export class ContentQualityScorecardFactory {
  public constructor(
    private readonly recommendationFactory = new ContentRecommendationFactory(),
    private readonly revisionFactory = new ContentRevisionGuidanceFactory(),
    private readonly contentScoreFactory = new ContentScoreFactory(),
  ) {}

  public create(
    input: ContentQualityScoringInput,
    options: ContentQualityScoringOptions,
    dimensions: readonly ContentDimensionScore[],
    evaluations: readonly ContentQualityRuleEvaluation[],
  ): ContentQualityScorecard {
    const criticalIssues = evaluations
      .filter((evaluation) => evaluation.criticality === "critical" && evaluation.status !== "pass")
      .slice(0, options.maximumIssueCount);
    const cappedOverall = applyCaps(weightedOverall(dimensions), criticalIssues.length);
    const recommendations = options.includeRecommendations
      ? this.recommendationFactory.create(evaluations, options.maximumRecommendationCount)
      : [];
    const revisionGuidance = options.includeRevisionGuidance ? this.revisionFactory.create(recommendations) : [];
    const readiness = approvalReadiness(
      cappedOverall,
      criticalIssues.length,
      options.minimumApprovalScore,
      options.minimumPublishScore,
      evaluations.some((evaluation) => evaluation.dimension === "complianceReadiness" && evaluation.status === "fail"),
    );
    const contentScore = this.contentScoreFactory.create({
      overallQuality: cappedOverall,
      ...scoreField(dimensions, "clarity", "clarity"),
      ...scoreField(dimensions, "relevance", "relevance"),
      ...scoreField(dimensions, "persuasiveness", "persuasiveness"),
      ...scoreField(dimensions, "readability", "readability"),
      ...scoreField(dimensions, "seoQuality", "seoQuality"),
      ...scoreField(dimensions, "brandAlignment", "brandAlignment"),
      ...scoreField(dimensions, "channelSuitability", "channelSuitability"),
      ...scoreField(dimensions, "complianceRisk", "complianceReadiness"),
      evaluationNotes: [
        `Scoring profile: ${options.scoringProfile}`,
        `Critical issues: ${criticalIssues.length}`,
        ...evaluations.filter((evaluation) => evaluation.status !== "pass").map((evaluation) => evaluation.ruleId).slice(0, 8),
      ],
    });

    if (options.assignScoreToContent && input.content !== undefined) {
      input.content.assignScore(contentScore);
    }

    return {
      contentId: input.contentId,
      overallScore: cappedOverall,
      dimensionScores: dimensions,
      appliedWeights: options.dimensionWeights,
      passedChecks: evaluations.filter((evaluation) => evaluation.status === "pass").map((evaluation) => evaluation.ruleId),
      failedChecks: evaluations.filter((evaluation) => evaluation.status === "fail").map((evaluation) => evaluation.ruleId),
      warnings: evaluations.filter((evaluation) => evaluation.status === "warning").map((evaluation) => evaluation.ruleId),
      criticalIssues,
      strengths: dimensions.filter((dimension) => dimension.score >= 85).map((dimension) => `${dimension.dimension} is strong.`),
      weaknesses: dimensions.filter((dimension) => dimension.score < 70).map((dimension) => `${dimension.dimension} needs revision.`),
      recommendations,
      revisionGuidance,
      approvalReadiness: readiness,
      publicationReadiness: readiness === "ready-for-publication",
      scoringProfile: options.scoringProfile,
      contentType: input.contentType,
      channel: input.channel,
      language: input.language,
      evaluatedMetadata: {
        sourceMetadata: input.sourceMetadata,
        campaignMetadata: input.campaignMetadata,
        correlationMetadata: input.correlationMetadata,
      },
      scoringVersion: "SACP Content Quality Rule Engine v1",
      evaluatedAt: new Date(),
      contentScore,
      ...(options.assignScoreToContent && input.content !== undefined ? { updatedContent: input.content } : {}),
    };
  }
}

function weightedOverall(dimensions: readonly ContentDimensionScore[]): number {
  return roundedScore(dimensions.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0));
}

function applyCaps(score: number, criticalIssueCount: number): number {
  if (criticalIssueCount >= 2) {
    return Math.min(score, 45);
  }
  if (criticalIssueCount === 1) {
    return Math.min(score, 60);
  }
  return score;
}

function approvalReadiness(
  score: number,
  criticalIssueCount: number,
  minimumApprovalScore: number,
  minimumPublishScore: number,
  complianceFailed: boolean,
): ContentQualityScorecard["approvalReadiness"] {
  if (criticalIssueCount > 0) {
    return "not-ready";
  }
  if (score < minimumApprovalScore) {
    return "needs-revision";
  }
  if (score < minimumPublishScore) {
    return "ready-for-review";
  }
  if (complianceFailed) {
    return "ready-for-approval";
  }
  return "ready-for-publication";
}

function dimensionValue(
  dimensions: readonly ContentDimensionScore[],
  dimension: ContentDimensionScore["dimension"],
): number | undefined {
  return dimensions.find((item) => item.dimension === dimension)?.score;
}

function scoreField(
  dimensions: readonly ContentDimensionScore[],
  field: "clarity" | "relevance" | "persuasiveness" | "readability" | "seoQuality" | "brandAlignment" | "channelSuitability" | "complianceRisk",
  dimension: ContentDimensionScore["dimension"],
): Partial<Record<typeof field, number>> {
  const value = dimensionValue(dimensions, dimension);
  return value === undefined ? {} : { [field]: value };
}
