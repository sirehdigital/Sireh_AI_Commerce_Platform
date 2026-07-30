import type { DeploymentReadinessResult } from "../release/index.js";
import type { DeploymentHealthReport, DeploymentResult } from "./deployment.types.js";

export class DeploymentVerifier {
  public verify(input: {
    readonly deployment?: DeploymentResult;
    readonly health?: DeploymentHealthReport;
  }): DeploymentReadinessResult {
    if (input.deployment === undefined || input.health === undefined) {
      return {
        ok: false,
        deploymentReference: "missing-safe-deployment",
        previousActiveThemeId: null,
        targetThemeId: "unknown",
        compatibilityPassed: false,
        validationPassed: false,
        warnings: [],
        failureCode: "STOREFRONT_DEPLOYMENT_NOT_READY",
        failureMessage: "Safe deployment must complete before production launch.",
      };
    }
    return {
      ok: input.health.readyForRelease,
      deploymentReference: input.deployment.deploymentReference,
      previousActiveThemeId: input.deployment.previousActiveThemeId,
      targetThemeId: input.deployment.draftThemeId ?? "unknown",
      compatibilityPassed: input.deployment.compatibility.errors.length === 0,
      validationPassed: input.deployment.validation.errors.length === 0 && input.health.packageIntegrity,
      warnings: input.health.warnings,
      ...(input.health.readyForRelease ? {} : {
        failureCode: "STOREFRONT_DEPLOYMENT_NOT_READY",
        failureMessage: input.health.errors.join("; "),
      }),
    };
  }
}

