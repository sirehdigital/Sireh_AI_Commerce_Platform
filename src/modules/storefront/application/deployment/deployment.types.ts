import type { StorefrontArtifact, StorefrontProject, StorefrontValidationReport } from "../../domain/index.js";
import type { ThemeArtifactBundle } from "../artifacts/index.js";

export type DeploymentMode = "PLAN_ONLY";
export type DeploymentCompatibilityStatus = "PASSED" | "FAILED" | "REQUIRES_REVIEW";
export type DeploymentUploadStatus = "SKIPPED_NOOP" | "UPLOADED_DRAFT" | "FAILED";
export type SafeDeploymentStatus = "PLANNED" | "VALIDATED" | "READY_FOR_RELEASE" | "FAILED";

export interface DeploymentCompatibilityResult {
  readonly status: DeploymentCompatibilityStatus;
  readonly apiVersion: string;
  readonly themeCompatible: boolean;
  readonly themeStructureValid: boolean;
  readonly requiredTemplatesValid: boolean;
  readonly requiredSectionsValid: boolean;
  readonly requiredAssetsValid: boolean;
  readonly manifestIntegrityValid: boolean;
  readonly bundleIntegrityValid: boolean;
  readonly storeCompatible: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresReview: boolean;
}

export interface DeploymentPlan {
  readonly planId: string;
  readonly projectId: string;
  readonly themeVersion: string;
  readonly bundleVersion: string;
  readonly targetStore: string;
  readonly deploymentMode: DeploymentMode;
  readonly rollbackReference: string;
  readonly compatibilityStatus: DeploymentCompatibilityStatus;
  readonly checklist: readonly string[];
  readonly createdAt: string;
}

export interface DeploymentPackage {
  readonly packageId: string;
  readonly projectId: string;
  readonly version: string;
  readonly bundleMetadata: Pick<ThemeArtifactBundle, "bundleVersion" | "bundleHash" | "artifactCount" | "requiresReview">;
  readonly themeMetadata: {
    readonly brandName: string;
    readonly targetStore: string;
    readonly themeTargetReference: string;
  };
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly artifactReferences: readonly string[];
  readonly hash: string;
  readonly deploymentSignature: string;
  readonly createdAt: string;
}

export interface DeploymentGatewayUploadInput {
  readonly project: StorefrontProject;
  readonly deploymentPackage: DeploymentPackage;
  readonly artifacts: readonly StorefrontArtifact[];
}

export interface DeploymentGatewayUploadResult {
  readonly ok: boolean;
  readonly gatewayId: string;
  readonly draftThemeId: string | null;
  readonly previousActiveThemeId: string | null;
  readonly uploadStatus: DeploymentUploadStatus;
  readonly deploymentReference: string;
  readonly warnings: readonly string[];
  readonly failureCode?: string;
  readonly failureMessage?: string;
}

export interface DeploymentResult {
  readonly deploymentId: string;
  readonly projectId: string;
  readonly status: SafeDeploymentStatus;
  readonly deploymentReference: string;
  readonly draftThemeId: string | null;
  readonly previousActiveThemeId: string | null;
  readonly compatibility: DeploymentCompatibilityResult;
  readonly deploymentPackage: DeploymentPackage;
  readonly upload: DeploymentGatewayUploadResult;
  readonly validation: StorefrontValidationReport;
  readonly warnings: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DeploymentHistory {
  readonly projectId: string;
  readonly deployments: readonly DeploymentResult[];
}

export interface RollbackPreparation {
  readonly rollbackId: string;
  readonly projectId: string;
  readonly previousThemeReference: string | null;
  readonly recoveryPlan: readonly string[];
  readonly validation: StorefrontValidationReport;
  readonly summary: string;
  readonly createdAt: string;
}

export interface DeploymentHealthReport {
  readonly projectId: string;
  readonly packageIntegrity: boolean;
  readonly compatibility: boolean;
  readonly deploymentStatus: SafeDeploymentStatus;
  readonly uploadStatus: DeploymentUploadStatus;
  readonly verificationResult: "PASSED" | "FAILED";
  readonly readyForRelease: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedAt: string;
}

