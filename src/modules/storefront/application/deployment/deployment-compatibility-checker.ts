import type { StorefrontArtifact, StorefrontProject, StorefrontValidationIssue } from "../../domain/index.js";
import type { DeploymentCompatibilityResult } from "./deployment.types.js";

const REQUIRED_TEMPLATE_PATHS = ["theme-preview/homepage.json", "theme-preview/product.json"];
const REQUIRED_ARTIFACT_PATHS = ["theme-preview/manifest.json", "theme-preview/bundle.json"];

export class DeploymentCompatibilityChecker {
  public check(input: {
    readonly project: StorefrontProject;
    readonly artifacts: readonly StorefrontArtifact[];
    readonly apiVersion?: string;
  }): DeploymentCompatibilityResult {
    const apiVersion = input.apiVersion ?? "2026-07";
    const paths = new Set(input.artifacts.map((artifact) => artifact.path));
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.project.mode !== "PLAN_ONLY") {
      errors.push("Safe deployment supports PLAN_ONLY storefront projects only.");
    }
    if (input.project.approvalId === undefined) {
      errors.push("Deployment approval reference is missing.");
    }
    if (input.project.validationSnapshot.errors.length > 0) {
      errors.push("Project validation contains blocking errors.");
    }
    for (const path of REQUIRED_ARTIFACT_PATHS) {
      if (!paths.has(path)) {
        errors.push(`Required artifact is missing: ${path}.`);
      }
    }
    for (const path of REQUIRED_TEMPLATE_PATHS) {
      if (!paths.has(path)) {
        errors.push(`Required template artifact is missing: ${path}.`);
      }
    }
    if (!paths.has("theme-preview/sections.json")) {
      warnings.push("Section definition artifact is missing; Shopify Theme Editor compatibility needs review.");
    }
    if (!paths.has("theme-preview/assets.json")) {
      warnings.push("Asset manifest artifact is missing; asset requirements need review.");
    }
    if (input.project.shopDomain !== undefined && !input.project.shopDomain.endsWith(".myshopify.com")) {
      errors.push("Store compatibility failed because shop domain is not a Shopify domain.");
    }

    return {
      status: errors.length > 0 ? "FAILED" : warnings.length > 0 ? "REQUIRES_REVIEW" : "PASSED",
      apiVersion,
      themeCompatible: input.project.themeTargetReference.length > 0,
      themeStructureValid: REQUIRED_ARTIFACT_PATHS.every((path) => paths.has(path)),
      requiredTemplatesValid: REQUIRED_TEMPLATE_PATHS.every((path) => paths.has(path)),
      requiredSectionsValid: paths.has("theme-preview/sections.json"),
      requiredAssetsValid: paths.has("theme-preview/assets.json"),
      manifestIntegrityValid: this.hasHash(input.artifacts, "theme-preview/manifest.json"),
      bundleIntegrityValid: this.hasHash(input.artifacts, "theme-preview/bundle.json"),
      storeCompatible: input.project.shopDomain === undefined || input.project.shopDomain.endsWith(".myshopify.com"),
      errors,
      warnings,
      requiresReview: true,
    };
  }

  public toValidationReport(result: DeploymentCompatibilityResult) {
    const errors = result.errors.map((message, index): StorefrontValidationIssue => ({
      code: `DEPLOYMENT_COMPATIBILITY_ERROR_${index + 1}`,
      message,
      severity: "ERROR",
      path: "deployment.compatibility",
    }));
    const warnings = result.warnings.map((message, index): StorefrontValidationIssue => ({
      code: `DEPLOYMENT_COMPATIBILITY_WARNING_${index + 1}`,
      message,
      severity: "WARNING",
      path: "deployment.compatibility",
    }));
    return {
      errors,
      warnings,
      blockedReasons: errors.map((issue) => issue.message),
      requiresHumanReview: true,
    };
  }

  private hasHash(artifacts: readonly StorefrontArtifact[], path: string): boolean {
    const artifact = artifacts.find((item) => item.path === path);
    return artifact?.contentHash.length === 64;
  }
}
