import { describe, expect, it } from "vitest";
import type { ContentQualityScorecard } from "../dto/content-quality-scoring.types.js";
import type { AIContentOrchestrationOptions } from "../dto/ai-content-orchestration.types.js";
import { AIContentQualityGateService } from "./ai-content-quality-gate.service.js";

describe("AIContentQualityGateService", () => {
  const service = new AIContentQualityGateService();

  it("passes content that satisfies approval and publication thresholds", () => {
    const result = service.evaluate([scorecard(92)], options());
    expect(result.status).toBe("passed");
    expect(result.approvalReady).toBe(true);
    expect(result.publicationReady).toBe(true);
  });

  it("fails a strict gate below the approval score", () => {
    const result = service.evaluate([scorecard(60)], options());
    expect(result.status).toBe("failed");
    expect(result.blockingReasons).toContain(
      "Average quality score is below the approval threshold.",
    );
  });

  it("lets critical safety issues override a high score", () => {
    const result = service.evaluate([scorecard(99, 1)], options());
    expect(result.status).toBe("failed");
    expect(result.criticalIssueCount).toBe(1);
    expect(result.publicationReady).toBe(false);
  });

  it("preserves packages as passed with warnings under advisory policy", () => {
    const result = service.evaluate([scorecard(60)], {
      ...options(),
      qualityGatePolicy: "advisory",
    });
    expect(result.status).toBe("passed-with-warnings");
    expect(result.blockingReasons.length).toBeGreaterThan(0);
  });
});

function options(): AIContentOrchestrationOptions {
  return {
    enabledStages: [],
    selectedSocialPlatforms: [],
    selectedVideoConfigurations: [],
    selectedEmailCampaignTypes: [],
    selectedBlogArticleTypes: [],
    targetLocales: [],
    strictSafetyMode: true,
    strictQualityMode: true,
    failurePolicy: "partial-success",
    qualityGatePolicy: "strict",
    minimumApprovalScore: 75,
    minimumPublicationScore: 85,
    maximumWarnings: 10,
    maximumCriticalIssues: 0,
    qualityProfiles: {},
    includeAuditTrail: true,
    includeExecutionMetrics: true,
    includeSkippedStageReasons: true,
    includeRawIntermediatePackages: true,
    includeLocalizedPackages: true,
  };
}

function scorecard(overallScore: number, criticalIssueCount = 0): ContentQualityScorecard {
  return {
    contentId: `content-${overallScore}`,
    overallScore,
    warnings: [],
    criticalIssues: Array.from({ length: criticalIssueCount }, () => ({ id: "critical" })),
    revisionGuidance: [],
    publicationReadiness: overallScore >= 85 && criticalIssueCount === 0,
  } as unknown as ContentQualityScorecard;
}
