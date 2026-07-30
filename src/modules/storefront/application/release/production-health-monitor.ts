import type { DeploymentReadinessResult, ProductionHealthReport, ReleaseMetadata } from "./release.types.js";

export class ProductionHealthMonitor {
  public check(input: {
    readonly release: ReleaseMetadata;
    readonly deployment: DeploymentReadinessResult;
    readonly activationOk: boolean;
    readonly checkedAt: string;
  }): ProductionHealthReport {
    const errors = [
      ...(input.activationOk ? [] : ["Theme activation did not complete successfully."]),
      ...(input.deployment.ok ? [] : ["Deployment readiness is not confirmed."]),
      ...(input.deployment.compatibilityPassed ? [] : ["Store compatibility is not confirmed."]),
    ];
    return {
      themeActive: input.activationOk,
      deploymentCompleted: input.deployment.ok,
      activationSuccess: input.activationOk,
      themeVersion: input.release.version,
      storeCompatibility: input.deployment.compatibilityPassed,
      noPartialActivation: errors.length === 0,
      checkedAt: input.checkedAt,
      errors,
    };
  }
}
