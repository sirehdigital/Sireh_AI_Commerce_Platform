import type { StorefrontValidationIssue, StorefrontValidationReport } from "../../domain/index.js";
import type {
  ManifestIndexPayload,
  SerializedThemeArtifact,
  ThemeArtifactBundle,
} from "./theme-artifact.types.js";

export interface ArtifactValidationResult {
  readonly report: StorefrontValidationReport;
  readonly score: number;
}

export class ArtifactValidator {
  public validate(input: {
    readonly artifacts: readonly SerializedThemeArtifact[];
    readonly manifest: ManifestIndexPayload;
    readonly bundle?: ThemeArtifactBundle;
  }): ArtifactValidationResult {
    const errors: StorefrontValidationIssue[] = [];
    const warnings: StorefrontValidationIssue[] = [];
    this.validateRequiredArtifacts(input.artifacts, errors);
    this.validateDuplicateIds(input.artifacts, errors);
    this.validateReferences(input.artifacts, input.manifest, errors);
    this.validateJsonPayloads(input.artifacts, errors);
    this.validateDynamicSources(input.artifacts, errors);
    this.validateSettings(input.artifacts, errors);
    this.validateMetadata(input.artifacts, warnings);
    const report = {
      errors,
      warnings,
      blockedReasons: errors.map((issue) => issue.message),
      requiresHumanReview: true,
    };
    return {
      report,
      score: Math.max(0, 100 - errors.length * 20 - warnings.length * 5),
    };
  }

  private validateRequiredArtifacts(artifacts: readonly SerializedThemeArtifact[], errors: StorefrontValidationIssue[]): void {
    for (const path of [
      "theme-preview/homepage.json",
      "theme-preview/product.json",
      "theme-preview/collections.json",
      "theme-preview/navigation.json",
      "theme-preview/settings.json",
      "theme-preview/metafields.json",
      "theme-preview/metaobjects.json",
      "theme-preview/assets.json",
      "theme-preview/manifest.json",
      "theme-preview/bundle.json",
    ]) {
      if (!artifacts.some((artifact) => artifact.path === path)) {
        errors.push(this.error("MISSING_ARTIFACT", "Required preview artifact is missing.", path));
      }
    }
  }

  private validateDuplicateIds(artifacts: readonly SerializedThemeArtifact[], errors: StorefrontValidationIssue[]): void {
    const paths = artifacts.map((artifact) => artifact.path);
    if (new Set(paths).size !== paths.length) {
      errors.push(this.error("DUPLICATE_ARTIFACT_ID", "Preview artifacts must not contain duplicate paths.", "artifacts"));
    }
  }

  private validateReferences(
    artifacts: readonly SerializedThemeArtifact[],
    manifest: ManifestIndexPayload,
    errors: StorefrontValidationIssue[],
  ): void {
    const artifactPaths = new Set(artifacts.map((artifact) => artifact.path));
    for (const item of manifest.artifacts) {
      if (!artifactPaths.has(item.path)) {
        errors.push(this.error("BROKEN_ARTIFACT_REFERENCE", "Manifest references a missing artifact.", item.path));
      }
      const artifact = artifacts.find((candidate) => candidate.path === item.path);
      if (artifact !== undefined && artifact.contentHash !== item.contentHash) {
        errors.push(this.error("BROKEN_ARTIFACT_REFERENCE", "Manifest content hash does not match artifact.", item.path));
      }
    }
  }

  private validateJsonPayloads(artifacts: readonly SerializedThemeArtifact[], errors: StorefrontValidationIssue[]): void {
    for (const artifact of artifacts) {
      if (artifact.path.endsWith(".json") && (typeof artifact.payload !== "object" || artifact.payload === null || Array.isArray(artifact.payload))) {
        errors.push(this.error("INVALID_JSON_PAYLOAD", "Preview artifact payload must be a JSON object.", artifact.path));
      }
    }
  }

  private validateDynamicSources(artifacts: readonly SerializedThemeArtifact[], errors: StorefrontValidationIssue[]): void {
    const artifact = artifacts.find((item) => item.path === "theme-preview/dynamic-sources.json");
    const sources = (artifact?.payload as { readonly dynamicSources?: readonly { readonly source?: unknown }[] } | undefined)?.dynamicSources ?? [];
    if (sources.some((item) => typeof item.source !== "string" || item.source.trim().length === 0 || item.source.includes(".."))) {
      errors.push(this.error("BROKEN_DYNAMIC_SOURCE_REFERENCE", "Dynamic source references must be complete.", "theme-preview/dynamic-sources.json"));
    }
  }

  private validateSettings(artifacts: readonly SerializedThemeArtifact[], errors: StorefrontValidationIssue[]): void {
    const artifact = artifacts.find((item) => item.path === "theme-preview/settings.json");
    const settings = (artifact?.payload as { readonly settings?: { readonly brandColors?: unknown; readonly typography?: unknown } } | undefined)?.settings;
    if (settings?.brandColors === undefined || settings.typography === undefined) {
      errors.push(this.error("MISSING_SETTINGS", "Theme settings preview requires colors and typography.", "theme-preview/settings.json"));
    }
  }

  private validateMetadata(artifacts: readonly SerializedThemeArtifact[], warnings: StorefrontValidationIssue[]): void {
    const metafields = (artifacts.find((item) => item.path === "theme-preview/metafields.json")?.payload as { readonly metafields?: readonly unknown[] } | undefined)?.metafields ?? [];
    const metaobjects = (artifacts.find((item) => item.path === "theme-preview/metaobjects.json")?.payload as { readonly metaobjects?: readonly unknown[] } | undefined)?.metaobjects ?? [];
    if (metafields.length === 0) {
      warnings.push(this.warning("METAFIELDS_EMPTY", "No metafield definition previews were generated.", "theme-preview/metafields.json"));
    }
    if (metaobjects.length === 0) {
      warnings.push(this.warning("METAOBJECTS_EMPTY", "No metaobject definition previews were generated.", "theme-preview/metaobjects.json"));
    }
  }

  private error(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "ERROR", path };
  }

  private warning(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "WARNING", path };
  }
}
