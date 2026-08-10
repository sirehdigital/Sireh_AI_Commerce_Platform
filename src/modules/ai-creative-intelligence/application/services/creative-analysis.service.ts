import { CreativeDimensionAnalyzer } from "../scoring/creative-dimension-analyzers.js";
import type { CreativeIntelligenceRepository } from "../ports/creative-intelligence.repository.js";
import {
  CreativeIntelligenceInvalidLifecycleTransitionError,
  CreativeIntelligenceInvalidRequestError,
  CreativeIntelligenceRecordNotFoundError,
} from "../../domain/errors/creative-intelligence.errors.js";
import type { CreativeAnalysisResult } from "../../domain/models/creative-analysis.model.js";
import type { CreativeIntelligenceRecord } from "../../domain/models/creative-intelligence.model.js";

export interface CreativeAnalysisServiceResult {
  readonly record: CreativeIntelligenceRecord;
  readonly analysis: CreativeAnalysisResult;
}

export class CreativeAnalysisService {
  private readonly analyzer = new CreativeDimensionAnalyzer();

  public constructor(private readonly repository: CreativeIntelligenceRepository) {}

  public async analyzeById(id: string): Promise<CreativeAnalysisServiceResult> {
    const normalizedId = this.normalizeLookupId(id);
    const record = await this.repository.findById(normalizedId);

    if (record === null) {
      throw new CreativeIntelligenceRecordNotFoundError("Creative intelligence record was not found for analysis.", { id: normalizedId });
    }

    return this.analyzeRecord(record);
  }

  public async analyzeByCreativeId(creativeId: string): Promise<CreativeAnalysisServiceResult> {
    const normalizedCreativeId = this.normalizeLookupId(creativeId);
    const record = await this.repository.findByCreativeId(normalizedCreativeId);

    if (record === null) {
      throw new CreativeIntelligenceRecordNotFoundError("Creative intelligence record was not found for analysis.", { creativeId: normalizedCreativeId });
    }

    return this.analyzeRecord(record);
  }

  public analyzePreview(record: CreativeIntelligenceRecord): CreativeAnalysisResult {
    return this.cloneAnalysis(this.analyzer.analyze(record));
  }

  private async analyzeRecord(record: CreativeIntelligenceRecord): Promise<CreativeAnalysisServiceResult> {
    if (record.analysisStatus !== "PENDING_ANALYSIS") {
      throw new CreativeIntelligenceInvalidLifecycleTransitionError("Creative intelligence record must be pending analysis before persisted analysis.", {
        id: record.id,
        currentStatus: record.analysisStatus,
        expectedStatus: "PENDING_ANALYSIS",
        targetStatus: "ANALYZED",
      });
    }

    const analysis = this.analyzer.analyze(record);
    const updatedRecord: CreativeIntelligenceRecord = {
      ...record,
      analysisStatus: "ANALYZED",
      analysis,
      platforms: [...record.platforms],
      targetMarkets: [...record.targetMarkets],
      brief: { ...record.brief },
      warnings: [...record.warnings],
    };
    const savedRecord = await this.repository.save(updatedRecord);

    return {
      record: savedRecord,
      analysis: this.cloneAnalysis(analysis),
    };
  }

  private normalizeLookupId(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new CreativeIntelligenceInvalidRequestError("Creative analysis lookup id cannot be blank.", { value });
    }

    return value.trim();
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
      metadata: { ...analysis.metadata },
    };
  }
}
