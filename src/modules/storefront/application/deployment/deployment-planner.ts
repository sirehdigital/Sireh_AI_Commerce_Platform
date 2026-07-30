import type { StorefrontProject } from "../../domain/index.js";
import type { ThemeArtifactBundle } from "../artifacts/index.js";
import type { DeploymentCompatibilityResult, DeploymentPlan } from "./deployment.types.js";

export class DeploymentPlanner {
  public plan(input: {
    readonly project: StorefrontProject;
    readonly bundle: ThemeArtifactBundle;
    readonly compatibility: DeploymentCompatibilityResult;
    readonly createdAt: string;
  }): DeploymentPlan {
    return {
      planId: `deployment-plan:${input.project.id}`,
      projectId: input.project.id,
      themeVersion: this.themeVersion(input.createdAt),
      bundleVersion: input.bundle.bundleVersion,
      targetStore: input.project.shopDomain ?? input.project.storeId,
      deploymentMode: "PLAN_ONLY",
      rollbackReference: `rollback-prep:${input.project.id}`,
      compatibilityStatus: input.compatibility.status,
      checklist: [
        "Approval reference exists.",
        "Artifact validation passed.",
        "Theme preview bundle exists.",
        "Manifest integrity checked.",
        "Draft theme upload is isolated behind DeploymentGateway.",
        "Production activation is reserved for SACP-03.03F.",
      ],
      createdAt: input.createdAt,
    };
  }

  private themeVersion(timestamp: string): string {
    return `draft-theme-${timestamp.replace(/[-:.]/gu, "").replace("T", "-").replace("Z", "")}`;
  }
}

