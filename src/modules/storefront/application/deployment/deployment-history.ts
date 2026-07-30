import type { DeploymentHistory, DeploymentResult } from "./deployment.types.js";

export class DeploymentHistoryBuilder {
  public append(input: {
    readonly projectId: string;
    readonly existing: readonly DeploymentResult[];
    readonly deployment: DeploymentResult;
  }): DeploymentHistory {
    return {
      projectId: input.projectId,
      deployments: input.existing.filter((item) => item.deploymentId !== input.deployment.deploymentId).concat(input.deployment),
    };
  }
}

