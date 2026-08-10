import type { PlatformSuitabilityAssessment } from "./creative-platform-suitability.model.js";
import type { PolicyRiskAssessment } from "./creative-policy-risk.model.js";
import type { CreativeRecommendation } from "./creative-recommendation.model.js";

export const CREATIVE_ANALYSIS_VERSION = "SACP-CREATIVE-ANALYSIS-v1";

export const CREATIVE_SCORE_LABEL = "Creative Quality / Readiness Score";

export const CREATIVE_ANALYSIS_DIMENSIONS = ["HOOK", "HEADLINE", "PRIMARY_TEXT", "CTA", "VISUAL_CONCEPT", "BRAND_CONSISTENCY"] as const;

export type CreativeAnalysisDimension = (typeof CREATIVE_ANALYSIS_DIMENSIONS)[number];

export const CREATIVE_FINDING_TYPES = ["STRENGTH", "WARNING", "IMPROVEMENT"] as const;

export type CreativeFindingType = (typeof CREATIVE_FINDING_TYPES)[number];

export const CREATIVE_FINDING_IMPACTS = ["LOW", "MEDIUM", "HIGH"] as const;

export type CreativeFindingImpact = (typeof CREATIVE_FINDING_IMPACTS)[number];

export interface CreativeAnalysisFinding {
  readonly dimension: CreativeAnalysisDimension;
  readonly type: CreativeFindingType;
  readonly code: string;
  readonly message: string;
  readonly impact: CreativeFindingImpact;
}

export interface CreativeDimensionAnalysis {
  readonly dimension: CreativeAnalysisDimension;
  readonly score: number;
  readonly findings: readonly CreativeAnalysisFinding[];
  readonly strengths: readonly string[];
  readonly improvementOpportunities: readonly string[];
}

export interface CreativeAnalysisMetadata {
  readonly scoringRule: "WEIGHTED_INTEGER_ROUND_HALF_UP";
  readonly scoreLabel: typeof CREATIVE_SCORE_LABEL;
  readonly advisoryOnly: true;
  readonly sourceRecordVersion: "SACP-CREATIVE-v1";
}

export interface CreativeAnalysisResult {
  readonly creativeIntelligenceId: string;
  readonly creativeId: string;
  readonly dimensions: readonly CreativeDimensionAnalysis[];
  readonly dimensionScores: Readonly<Record<CreativeAnalysisDimension, number>>;
  readonly overallScore: number;
  readonly findings: readonly CreativeAnalysisFinding[];
  readonly strengths: readonly string[];
  readonly improvementOpportunities: readonly string[];
  readonly platformSuitability?: readonly PlatformSuitabilityAssessment[];
  readonly policyRisk?: PolicyRiskAssessment;
  readonly recommendations?: readonly CreativeRecommendation[];
  readonly analysisVersion: typeof CREATIVE_ANALYSIS_VERSION;
  readonly metadata: CreativeAnalysisMetadata;
}
