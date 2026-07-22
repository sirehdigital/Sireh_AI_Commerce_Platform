import type { ProductMediaSource } from "../../domain/models/index.js";

export interface ProductMediaSourceValidationResult {
  readonly validSources: readonly ProductMediaSource[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const SUPPORTED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MINIMUM_SOURCE_DIMENSION = 512;

export class ProductMediaSourceValidator {
  public validate(sources: readonly ProductMediaSource[]): ProductMediaSourceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenUrls = new Set<string>();
    const validSources: ProductMediaSource[] = [];

    for (const source of sources) {
      const normalizedUrl = source.originalUrl.trim();
      const sourceErrors: string[] = [];

      if (!/^https:\/\//iu.test(normalizedUrl)) {
        sourceErrors.push(`Source ${source.sourceAssetId} must use an https URL.`);
      }

      if (seenUrls.has(normalizedUrl.toLowerCase())) {
        sourceErrors.push(`Source ${source.sourceAssetId} duplicates another media URL.`);
      }
      seenUrls.add(normalizedUrl.toLowerCase());

      if (source.contentType !== undefined && !SUPPORTED_CONTENT_TYPES.has(source.contentType)) {
        sourceErrors.push(`Source ${source.sourceAssetId} has unsupported content type.`);
      }

      if ((source.width !== undefined && source.width < MINIMUM_SOURCE_DIMENSION) || (source.height !== undefined && source.height < MINIMUM_SOURCE_DIMENSION)) {
        warnings.push(`Source ${source.sourceAssetId} may be too low resolution for premium media.`);
      }

      if (source.licenseStatus === "unknown") {
        warnings.push(`Source ${source.sourceAssetId} has unknown usage rights.`);
      }

      if (/token|secret|password|credential|authorization|api[-_]?key/iu.test(JSON.stringify(source))) {
        sourceErrors.push(`Source ${source.sourceAssetId} contains unsafe metadata.`);
      }

      if (sourceErrors.length === 0) {
        validSources.push({ ...source, validationStatus: warnings.length > 0 ? "warning" : "valid" });
      } else {
        errors.push(...sourceErrors);
      }
    }

    return { validSources, errors, warnings };
  }
}
