import type { DeploymentHealthReport, DeploymentResult } from "./deployment.types.js";

export class DeploymentHealthChecker {
  public check(input: { readonly deployment: DeploymentResult; readonly checkedAt: string }): DeploymentHealthReport {
    const packageIntegrity = input.deployment.deploymentPackage.hash.length === 64 &&
      input.deployment.deploymentPackage.deploymentSignature === `sha256:${input.deployment.deploymentPackage.hash}`;
    const compatibility = input.deployment.compatibility.errors.length === 0;
    const uploadOk = input.deployment.upload.ok;
    const readyForRelease = packageIntegrity && compatibility && uploadOk && input.deployment.status === "READY_FOR_RELEASE";
    return {
      projectId: input.deployment.projectId,
      packageIntegrity,
      compatibility,
      deploymentStatus: input.deployment.status,
      uploadStatus: input.deployment.upload.uploadStatus,
      verificationResult: readyForRelease ? "PASSED" : "FAILED",
      readyForRelease,
      errors: readyForRelease ? [] : ["Safe deployment is not ready for production release."],
      warnings: input.deployment.warnings,
      checkedAt: input.checkedAt,
    };
  }
}

