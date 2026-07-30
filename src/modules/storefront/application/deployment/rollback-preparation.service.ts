import type { StorefrontValidationIssue } from "../../domain/index.js";
import type { DeploymentResult, RollbackPreparation } from "./deployment.types.js";

export class RollbackPreparationService {
  public prepare(input: { readonly deployment: DeploymentResult; readonly createdAt: string }): RollbackPreparation {
    const errors: StorefrontValidationIssue[] = input.deployment.previousActiveThemeId === null
      ? [{ code: "ROLLBACK_PREVIOUS_THEME_MISSING", message: "Previous active theme reference is not available.", severity: "ERROR", path: "rollback.previousThemeReference" }]
      : [];
    return {
      rollbackId: `rollback-prep:${input.deployment.projectId}`,
      projectId: input.deployment.projectId,
      previousThemeReference: input.deployment.previousActiveThemeId,
      recoveryPlan: [
        "Stop release workflow before activation if deployment health fails.",
        "Keep previous active theme reference for production rollback.",
        "Use Production Launch rollback executor only after a release exists.",
      ],
      validation: {
        errors,
        warnings: [],
        blockedReasons: errors.map((issue) => issue.message),
        requiresHumanReview: true,
      },
      summary: errors.length === 0 ? "Rollback metadata prepared with previous active theme reference." : "Rollback metadata requires review before launch.",
      createdAt: input.createdAt,
    };
  }
}

