import { InvalidContentSEOConfigurationError } from "../errors/content-domain.errors.js";
import type { ContentSEO, ContentType } from "../types/content.types.js";

const SEO_REQUIRED_TYPES: readonly ContentType[] = ["seo-title", "seo-description", "blog-article"];

export class ContentSEOValidator {
  public assertValid(type: ContentType, seo: ContentSEO | undefined): void {
    if (!SEO_REQUIRED_TYPES.includes(type)) {
      return;
    }

    if (seo === undefined) {
      throw new InvalidContentSEOConfigurationError("SEO configuration is required for SEO-oriented content.", {
        type,
      });
    }

    if (seo.primaryKeyword === undefined) {
      throw new InvalidContentSEOConfigurationError("Primary keyword is required for SEO-oriented content.", {
        type,
      });
    }

    if (type === "seo-title" && seo.metaTitle === undefined) {
      throw new InvalidContentSEOConfigurationError("Meta title is required for SEO title content.", {
        type,
      });
    }

    if (type === "seo-description" && seo.metaDescription === undefined) {
      throw new InvalidContentSEOConfigurationError(
        "Meta description is required for SEO description content.",
        { type },
      );
    }
  }
}
