import type { DeploymentGatewayUploadInput, DeploymentGatewayUploadResult } from "./deployment.types.js";

export interface DeploymentGateway {
  readonly id: string;
  uploadDraftTheme(input: DeploymentGatewayUploadInput): Promise<DeploymentGatewayUploadResult> | DeploymentGatewayUploadResult;
}

