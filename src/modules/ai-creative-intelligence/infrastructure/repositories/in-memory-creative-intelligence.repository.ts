import type { CreativeIntelligenceRepository } from "../../application/ports/creative-intelligence.repository.js";
import type { CreativeIntelligenceRecord } from "../../domain/models/creative-intelligence.model.js";

export class InMemoryCreativeIntelligenceRepository implements CreativeIntelligenceRepository {
  private readonly recordsById = new Map<string, CreativeIntelligenceRecord>();
  private readonly idsByCreativeId = new Map<string, string>();

  public save(record: CreativeIntelligenceRecord): Promise<CreativeIntelligenceRecord> {
    const clone = this.cloneRecord(record);
    const existing = this.recordsById.get(clone.id);
    const creativeLookup = this.normalizeCreativeLookup(clone.creativeId);

    if (existing !== undefined) {
      const previousCreativeLookup = this.normalizeCreativeLookup(existing.creativeId);

      if (previousCreativeLookup !== creativeLookup && this.idsByCreativeId.get(previousCreativeLookup) === clone.id) {
        this.idsByCreativeId.delete(previousCreativeLookup);
      }
    }

    this.recordsById.set(clone.id, clone);
    this.idsByCreativeId.set(creativeLookup, clone.id);
    return Promise.resolve(this.cloneRecord(clone));
  }

  public findById(id: string): Promise<CreativeIntelligenceRecord | null> {
    const record = this.recordsById.get(id.trim());
    return Promise.resolve(record === undefined ? null : this.cloneRecord(record));
  }

  public findByCreativeId(creativeId: string): Promise<CreativeIntelligenceRecord | null> {
    const id = this.idsByCreativeId.get(this.normalizeCreativeLookup(creativeId));
    if (id === undefined) {
      return Promise.resolve(null);
    }

    return this.findById(id);
  }

  public list(): Promise<readonly CreativeIntelligenceRecord[]> {
    return Promise.resolve(
      [...this.recordsById.values()]
        .sort((left, right) => left.registeredAt.localeCompare(right.registeredAt) || left.id.localeCompare(right.id))
        .map((record) => this.cloneRecord(record)),
    );
  }

  public clear(): void {
    this.recordsById.clear();
    this.idsByCreativeId.clear();
  }

  private cloneRecord(record: CreativeIntelligenceRecord): CreativeIntelligenceRecord {
    return {
      ...record,
      platforms: [...record.platforms],
      targetMarkets: [...record.targetMarkets],
      brief: { ...record.brief },
      ...(record.analysis === undefined
        ? {}
        : {
            analysis: {
              ...record.analysis,
              dimensions: record.analysis.dimensions.map((dimension) => ({
                ...dimension,
                findings: dimension.findings.map((finding) => ({ ...finding })),
                strengths: [...dimension.strengths],
                improvementOpportunities: [...dimension.improvementOpportunities],
              })),
              dimensionScores: { ...record.analysis.dimensionScores },
              findings: record.analysis.findings.map((finding) => ({ ...finding })),
              strengths: [...record.analysis.strengths],
              improvementOpportunities: [...record.analysis.improvementOpportunities],
              ...(record.analysis.platformSuitability === undefined
                ? {}
                : {
                    platformSuitability: record.analysis.platformSuitability.map((assessment) => ({
                      ...assessment,
                      findings: assessment.findings.map((finding) => ({
                        ...finding,
                        evidence: finding.evidence.map((evidence) => ({ ...evidence })),
                      })),
                    })),
                  }),
              ...(record.analysis.policyRisk === undefined
                ? {}
                : {
                    policyRisk: {
                      ...record.analysis.policyRisk,
                      findings: record.analysis.policyRisk.findings.map((finding) => ({ ...finding })),
                    },
                  }),
              metadata: { ...record.analysis.metadata },
            },
          }),
      warnings: [...record.warnings],
    };
  }

  private normalizeCreativeLookup(creativeId: string): string {
    return creativeId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "");
  }
}
