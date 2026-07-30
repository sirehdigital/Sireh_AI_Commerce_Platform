import type { StorefrontArtifact, StorefrontProject, StorefrontValidationReport } from "../../domain/index.js";

export type ReleaseStatus = "PENDING_REVIEW" | "ACTIVATED" | "FAILED" | "ROLLED_BACK";
export type RollbackStatus = "EXECUTED" | "FAILED";

export interface ReleaseMetadata {
  readonly releaseId: string;
  readonly projectId: string;
  readonly status: ReleaseStatus;
  readonly version: string;
  readonly activatedThemeId: string;
  readonly previousActiveThemeId: string | null;
  readonly deploymentReference: string;
  readonly rollbackReference: string;
  readonly releaseNotes: readonly string[];
  readonly bundleHash: string;
  readonly artifactCount: number;
  readonly deploymentTimestamp: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RollbackMetadata {
  readonly rollbackId: string;
  readonly projectId: string;
  readonly releaseId: string;
  readonly status: RollbackStatus;
  readonly restoredThemeId: string;
  readonly replacedThemeId: string;
  readonly executedAt: string;
  readonly validation: StorefrontValidationReport;
}

export interface ProductionHealthReport {
  readonly themeActive: boolean;
  readonly deploymentCompleted: boolean;
  readonly activationSuccess: boolean;
  readonly themeVersion: string;
  readonly storeCompatibility: boolean;
  readonly noPartialActivation: boolean;
  readonly checkedAt: string;
  readonly errors: readonly string[];
}

export interface ProductionReleaseSummary {
  readonly projectId: string;
  readonly status: ReleaseStatus;
  readonly version: string;
  readonly releaseId: string;
  readonly rollbackReference: string;
  readonly health: ProductionHealthReport;
  readonly releaseNotes: readonly string[];
}

export interface DeploymentReadinessResult {
  readonly ok: boolean;
  readonly deploymentReference: string;
  readonly previousActiveThemeId: string | null;
  readonly targetThemeId: string;
  readonly compatibilityPassed: boolean;
  readonly validationPassed: boolean;
  readonly warnings: readonly string[];
  readonly failureCode?: string;
  readonly failureMessage?: string;
}

export interface ReleaseValidationInput {
  readonly project: StorefrontProject;
  readonly artifacts: readonly StorefrontArtifact[];
  readonly deployment: DeploymentReadinessResult;
}

export interface ReleaseValidationResult {
  readonly report: StorefrontValidationReport;
  readonly bundleHash: string;
  readonly artifactCount: number;
}
