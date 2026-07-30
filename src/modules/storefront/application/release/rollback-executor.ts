import type { StorefrontValidationReport } from "../../domain/index.js";
import type { ReleaseMetadata, RollbackMetadata } from "./release.types.js";

export class RollbackExecutor {
  public execute(input: {
    readonly rollbackId: string;
    readonly release: ReleaseMetadata;
    readonly executedAt: string;
  }): RollbackMetadata {
    const validation = this.validate(input.release);
    return {
      rollbackId: input.rollbackId,
      projectId: input.release.projectId,
      releaseId: input.release.releaseId,
      status: validation.errors.length === 0 ? "EXECUTED" : "FAILED",
      restoredThemeId: input.release.previousActiveThemeId ?? "unknown",
      replacedThemeId: input.release.activatedThemeId,
      executedAt: input.executedAt,
      validation,
    };
  }

  private validate(release: ReleaseMetadata): StorefrontValidationReport {
    const errors = release.previousActiveThemeId === null
      ? [{ code: "ROLLBACK_REFERENCE_MISSING", message: "Rollback requires a previous active theme reference.", severity: "ERROR" as const, path: "release.previousActiveThemeId" }]
      : [];
    return {
      errors,
      warnings: [],
      blockedReasons: errors.map((issue) => issue.message),
      requiresHumanReview: true,
    };
  }
}
