import type { DeploymentReadinessResult, ReleaseMetadata } from "./release.types.js";

export class ReleaseManager {
  public register(input: {
    readonly releaseId: string;
    readonly projectId: string;
    readonly version: string;
    readonly deployment: DeploymentReadinessResult;
    readonly bundleHash: string;
    readonly artifactCount: number;
    readonly releaseNotes: readonly string[];
    readonly timestamp: string;
  }): ReleaseMetadata {
    return {
      releaseId: input.releaseId,
      projectId: input.projectId,
      status: "ACTIVATED",
      version: input.version,
      activatedThemeId: input.deployment.targetThemeId,
      previousActiveThemeId: input.deployment.previousActiveThemeId,
      deploymentReference: input.deployment.deploymentReference,
      rollbackReference: `rollback:${input.projectId}:${input.deployment.previousActiveThemeId ?? "none"}`,
      releaseNotes: input.releaseNotes,
      bundleHash: input.bundleHash,
      artifactCount: input.artifactCount,
      deploymentTimestamp: input.timestamp,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    };
  }
}
