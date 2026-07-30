import type { DeploymentGateway } from "./deployment-gateway.js";
import type { DeploymentGatewayUploadInput, DeploymentGatewayUploadResult } from "./deployment.types.js";

export class FakeDeploymentGateway implements DeploymentGateway {
  public readonly id = "fake-deployment-gateway";
  public uploadCount = 0;

  public uploadDraftTheme(input: DeploymentGatewayUploadInput): DeploymentGatewayUploadResult {
    this.uploadCount += 1;
    return {
      ok: true,
      gatewayId: this.id,
      draftThemeId: `fake-draft-theme:${input.project.id}`,
      previousActiveThemeId: "fake-active-theme",
      uploadStatus: "UPLOADED_DRAFT",
      deploymentReference: `fake-deployment:${input.project.id}:${this.uploadCount}`,
      warnings: [],
    };
  }
}

