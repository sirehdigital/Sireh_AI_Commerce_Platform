import { CreativeAnalysisService } from "../services/creative-analysis.service.js";
import type { CreativeIntelligenceRepository } from "../ports/creative-intelligence.repository.js";
import type { CreativeAnalysisResult } from "../../domain/models/creative-analysis.model.js";
import type { CreativeIntelligenceRecord } from "../../domain/models/creative-intelligence.model.js";
import {
  CREATIVE_INTELLIGENCE_PIPELINE_VERSION,
  type CreativeIntelligencePipelineResult,
} from "../../domain/models/creative-intelligence-pipeline.model.js";

export class CreativeIntelligencePipelineService {
  private readonly analysisService: CreativeAnalysisService;

  public constructor(repository: CreativeIntelligenceRepository) {
    this.analysisService = new CreativeAnalysisService(repository);
  }

  public async runById(id: string): Promise<CreativeIntelligencePipelineResult> {
    const result = await this.analysisService.analyzeById(id);
    return this.toPipelineResult(result.record, result.analysis);
  }

  public async runByCreativeId(creativeId: string): Promise<CreativeIntelligencePipelineResult> {
    const result = await this.analysisService.analyzeByCreativeId(creativeId);
    return this.toPipelineResult(result.record, result.analysis);
  }

  public runPreview(record: CreativeIntelligenceRecord): CreativeIntelligencePipelineResult {
    return this.toPipelineResult(record, this.analysisService.analyzePreview(record));
  }

  private toPipelineResult(record: CreativeIntelligenceRecord, analysis: CreativeAnalysisResult): CreativeIntelligencePipelineResult {
    const creativeQuality = this.cloneAnalysis(analysis);

    return {
      creativeIntelligenceId: record.id,
      creativeId: record.creativeId,
      productId: record.productId,
      ...(record.sourceContentId === undefined ? {} : { sourceContentId: record.sourceContentId }),
      status: record.analysisStatus,
      platforms: [...record.platforms],
      targetMarkets: [...record.targetMarkets],
      creativeQuality,
      platformSuitability: creativeQuality.platformSuitability ?? [],
      policyRisk: creativeQuality.policyRisk ?? { overallRisk: "LOW", requiresHumanReview: false, findings: [] },
      recommendations: creativeQuality.recommendations ?? [],
      versionMetadata: {
        pipelineVersion: CREATIVE_INTELLIGENCE_PIPELINE_VERSION,
        analysisVersion: creativeQuality.analysisVersion,
        sourceRecordVersion: creativeQuality.metadata.sourceRecordVersion,
      },
      governance: {
        advisoryOnly: true,
        providerIndependent: true,
        noPublishing: true,
        humanReviewRequired: creativeQuality.policyRisk?.requiresHumanReview === true,
      },
    };
  }

  private cloneAnalysis(analysis: CreativeAnalysisResult): CreativeAnalysisResult {
    return {
      ...analysis,
      dimensions: analysis.dimensions.map((dimension) => ({
        ...dimension,
        findings: dimension.findings.map((finding) => ({ ...finding })),
        strengths: [...dimension.strengths],
        improvementOpportunities: [...dimension.improvementOpportunities],
      })),
      dimensionScores: { ...analysis.dimensionScores },
      findings: analysis.findings.map((finding) => ({ ...finding })),
      strengths: [...analysis.strengths],
      improvementOpportunities: [...analysis.improvementOpportunities],
      ...(analysis.platformSuitability === undefined
        ? {}
        : {
            platformSuitability: analysis.platformSuitability.map((assessment) => ({
              ...assessment,
              findings: assessment.findings.map((finding) => ({
                ...finding,
                evidence: finding.evidence.map((evidence) => ({ ...evidence })),
              })),
            })),
          }),
      ...(analysis.policyRisk === undefined
        ? {}
        : {
            policyRisk: {
              ...analysis.policyRisk,
              findings: analysis.policyRisk.findings.map((finding) => ({ ...finding })),
            },
          }),
      ...(analysis.recommendations === undefined
        ? {}
        : {
            recommendations: analysis.recommendations.map((recommendation) => ({
              ...recommendation,
              evidence: [...recommendation.evidence],
            })),
          }),
      metadata: { ...analysis.metadata },
    };
  }
}
