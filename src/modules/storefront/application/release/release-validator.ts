import type { StorefrontValidationIssue } from "../../domain/index.js";
import type { ReleaseValidationInput, ReleaseValidationResult } from "./release.types.js";

export class ReleaseValidator {
  public validate(input: ReleaseValidationInput): ReleaseValidationResult {
    const errors: StorefrontValidationIssue[] = [];
    const warnings: StorefrontValidationIssue[] = [];
    const bundle = input.artifacts.find((artifact) => artifact.path === "theme-preview/bundle.json");
    const manifest = input.artifacts.find((artifact) => artifact.path === "theme-preview/manifest.json");

    if (input.project.approvalId === undefined) {
      errors.push(this.error("RELEASE_APPROVAL_MISSING", "Production release requires an approval reference.", "project.approvalId"));
    }
    if (input.project.validationSnapshot.errors.length > 0) {
      errors.push(this.error("PROJECT_VALIDATION_FAILED", "Project validation must pass before production release.", "project.validationSnapshot"));
    }
    if (bundle === undefined) {
      errors.push(this.error("ARTIFACT_VALIDATION_MISSING", "Validated artifact bundle is required before production release.", "theme-preview/bundle.json"));
    }
    if (manifest === undefined) {
      errors.push(this.error("RELEASE_MANIFEST_MISSING", "Manifest is required before production release.", "theme-preview/manifest.json"));
    }
    if (!input.deployment.validationPassed) {
      errors.push(this.error("DEPLOYMENT_VALIDATION_FAILED", "Deployment validation must pass before production release.", "deployment.validation"));
    }
    if (!input.deployment.compatibilityPassed) {
      errors.push(this.error("STORE_COMPATIBILITY_FAILED", "Store compatibility must pass before production release.", "deployment.compatibility"));
    }
    if (!input.deployment.ok) {
      errors.push(this.error(input.deployment.failureCode ?? "DEPLOYMENT_NOT_READY", input.deployment.failureMessage ?? "Deployment readiness check failed.", "deployment"));
    }
    if (input.deployment.warnings.length > 0) {
      warnings.push(...input.deployment.warnings.map((warning) => this.warning("DEPLOYMENT_READINESS_WARNING", warning, "deployment.warnings")));
    }

    return {
      report: {
        errors,
        warnings,
        blockedReasons: errors.map((issue) => issue.message),
        requiresHumanReview: true,
      },
      bundleHash: this.bundleHash(bundle),
      artifactCount: this.artifactCount(bundle, input.artifacts.length),
    };
  }

  private bundleHash(bundle: ReleaseValidationInput["artifacts"][number] | undefined): string {
    const payload = bundle?.contentSnapshot as { readonly bundleHash?: unknown } | undefined;
    return typeof payload?.bundleHash === "string" ? payload.bundleHash : "unknown";
  }

  private artifactCount(bundle: ReleaseValidationInput["artifacts"][number] | undefined, fallback: number): number {
    const payload = bundle?.contentSnapshot as { readonly artifactCount?: unknown } | undefined;
    return typeof payload?.artifactCount === "number" ? payload.artifactCount : fallback;
  }

  private error(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "ERROR", path };
  }

  private warning(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "WARNING", path };
  }
}
