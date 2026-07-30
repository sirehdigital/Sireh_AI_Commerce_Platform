import type { ProductionHealthReport, ProductionReleaseSummary, ReleaseMetadata } from "./release.types.js";

export class ReleaseSummaryBuilder {
  public build(release: ReleaseMetadata, health: ProductionHealthReport): ProductionReleaseSummary {
    return {
      projectId: release.projectId,
      status: release.status,
      version: release.version,
      releaseId: release.releaseId,
      rollbackReference: release.rollbackReference,
      health,
      releaseNotes: release.releaseNotes,
    };
  }
}
