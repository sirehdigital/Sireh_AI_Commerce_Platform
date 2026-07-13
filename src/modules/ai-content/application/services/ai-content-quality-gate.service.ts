import type { ContentQualityScorecard } from "../dto/content-quality-scoring.types.js";
import type {
  AIContentOrchestrationOptions,
  AIContentQualityGateResult,
} from "../dto/ai-content-orchestration.types.js";

export class AIContentQualityGateService {
  public evaluate(
    scorecards: readonly ContentQualityScorecard[],
    options: AIContentOrchestrationOptions,
  ): AIContentQualityGateResult {
    const warningCount = scorecards.reduce(
      (total, scorecard) => total + scorecard.warnings.length,
      0,
    );
    const criticalIssueCount = scorecards.reduce(
      (total, scorecard) => total + scorecard.criticalIssues.length,
      0,
    );
    const averageScore =
      scorecards.length === 0
        ? 0
        : Math.round(
            scorecards.reduce((total, scorecard) => total + scorecard.overallScore, 0) /
              scorecards.length,
          );
    const blockingReasons: string[] = [];
    if (scorecards.length === 0) blockingReasons.push("No eligible content was scored.");
    if (averageScore < options.minimumApprovalScore)
      blockingReasons.push("Average quality score is below the approval threshold.");
    if (criticalIssueCount > options.maximumCriticalIssues)
      blockingReasons.push("Critical issue limit exceeded.");
    if (warningCount > options.maximumWarnings) blockingReasons.push("Warning limit exceeded.");
    const affectedPackageIds = scorecards
      .filter(
        (scorecard) =>
          scorecard.overallScore < options.minimumApprovalScore ||
          scorecard.criticalIssues.length > 0,
      )
      .map((scorecard) => scorecard.contentId);
    const strictFailure = options.qualityGatePolicy === "strict" && blockingReasons.length > 0;
    const publicationReady =
      !strictFailure &&
      averageScore >= options.minimumPublicationScore &&
      scorecards.every((scorecard) => scorecard.publicationReadiness);
    return {
      status: strictFailure
        ? "failed"
        : blockingReasons.length > 0 || warningCount > 0
          ? "passed-with-warnings"
          : "passed",
      blockingReasons,
      affectedPackageIds,
      requiredRevisions: scorecards.flatMap((scorecard) =>
        scorecard.revisionGuidance.map((item) => item.suggestedAction),
      ),
      approvalReady: !strictFailure && averageScore >= options.minimumApprovalScore,
      publicationReady,
      averageScore,
      warningCount,
      criticalIssueCount,
    };
  }
}
