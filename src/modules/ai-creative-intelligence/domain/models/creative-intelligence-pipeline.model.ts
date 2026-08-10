import type { CreativeAnalysisResult } from "./creative-analysis.model.js";
import type { CreativeAnalysisStatus, CreativePlatform } from "./creative-intelligence.model.js";
import type { PlatformSuitabilityAssessment } from "./creative-platform-suitability.model.js";
import type { PolicyRiskAssessment } from "./creative-policy-risk.model.js";
import type { CreativeRecommendation } from "./creative-recommendation.model.js";

export const CREATIVE_INTELLIGENCE_PIPELINE_VERSION = "SACP-CREATIVE-PIPELINE-v1";

export interface CreativeIntelligencePipelineVersionMetadata {
  readonly pipelineVersion: typeof CREATIVE_INTELLIGENCE_PIPELINE_VERSION;
  readonly analysisVersion: CreativeAnalysisResult["analysisVersion"];
  readonly sourceRecordVersion: CreativeAnalysisResult["metadata"]["sourceRecordVersion"];
}

export interface CreativeIntelligencePipelineGovernanceMetadata {
  readonly advisoryOnly: true;
  readonly providerIndependent: true;
  readonly noPublishing: true;
  readonly humanReviewRequired: boolean;
}

export interface CreativeIntelligencePipelineResult {
  readonly creativeIntelligenceId: string;
  readonly creativeId: string;
  readonly productId: string;
  readonly sourceContentId?: string;
  readonly status: CreativeAnalysisStatus;
  readonly platforms: readonly CreativePlatform[];
  readonly targetMarkets: readonly string[];
  readonly creativeQuality: CreativeAnalysisResult;
  readonly platformSuitability: readonly PlatformSuitabilityAssessment[];
  readonly policyRisk: PolicyRiskAssessment;
  readonly recommendations: readonly CreativeRecommendation[];
  readonly versionMetadata: CreativeIntelligencePipelineVersionMetadata;
  readonly governance: CreativeIntelligencePipelineGovernanceMetadata;
}
