import type { ContentQualityScorecard } from "../dto/content-quality-scoring.types.js";

export interface ContentQualityScorecardSnapshot {
  readonly contentId: string;
  readonly overallScore: number;
  readonly scoringProfile: string;
  readonly approvalReadiness: string;
  readonly publicationReadiness: boolean;
  readonly criticalIssueCount: number;
  readonly recommendationCount: number;
  readonly evaluatedAt: Date;
}

export class ContentQualityScorecardMapper {
  public toSnapshot(scorecard: ContentQualityScorecard): ContentQualityScorecardSnapshot {
    return {
      contentId: scorecard.contentId,
      overallScore: scorecard.overallScore,
      scoringProfile: scorecard.scoringProfile,
      approvalReadiness: scorecard.approvalReadiness,
      publicationReadiness: scorecard.publicationReadiness,
      criticalIssueCount: scorecard.criticalIssues.length,
      recommendationCount: scorecard.recommendations.length,
      evaluatedAt: new Date(scorecard.evaluatedAt),
    };
  }
}
