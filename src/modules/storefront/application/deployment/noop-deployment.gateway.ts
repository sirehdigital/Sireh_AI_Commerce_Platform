import type { DeploymentGateway } from "./deployment-gateway.js";
import type { DeploymentGatewayUploadInput, DeploymentGatewayUploadResult } from "./deployment.types.js";

export class NoOpDeploymentGateway implements DeploymentGateway {
  public readonly id = "noop-deployment-gateway";

  public uploadDraftTheme(input: DeploymentGatewayUploadInput): DeploymentGatewayUploadResult {
    return {
      ok: true,
      gatewayId: this.id,
      draftThemeId: `noop-draft-theme:${input.project.id}`,
      previousActiveThemeId: input.project.themeTargetReference.length > 0 ? input.project.themeTargetReference : null,
      uploadStatus: "SKIPPED_NOOP",
      deploymentReference: `noop-deployment:${input.project.id}:${input.deploymentPackage.hash.slice(0, 12)}`,
      warnings: ["NoOpDeploymentGateway prepared deployment metadata without making external Shopify calls."],
    };
  }
}

