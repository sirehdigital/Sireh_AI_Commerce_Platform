import type { DeploymentGateway } from "./deployment-gateway.js";
import type { DeploymentGatewayUploadInput, DeploymentGatewayUploadResult } from "./deployment.types.js";
import { NoOpDeploymentGateway } from "./noop-deployment.gateway.js";

export class DraftThemeUploader {
  public constructor(private readonly gateway: DeploymentGateway = new NoOpDeploymentGateway()) {}

  public upload(input: DeploymentGatewayUploadInput): Promise<DeploymentGatewayUploadResult> | DeploymentGatewayUploadResult {
    return this.gateway.uploadDraftTheme(input);
  }
}

