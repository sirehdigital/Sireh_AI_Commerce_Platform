import type { SEOContentPackage, SEOReadinessCheck } from "../dto/seo-content.types.js";
import { InvalidSEOMetadataError } from "../errors/product-content.errors.js";

export class SEOMetadataQualityService {
  public validate(productContentPackage: SEOContentPackage): SEOReadinessCheck {
    const checks: string[] = [];
    const warnings: string[] = [...productContentPackage.warnings];
    const primaryKeyword = productContentPackage.keywords.primaryKeyword.value;
    const metaTitle = productContentPackage.metaTitle.value.toLowerCase();
    const metaDescription = productContentPackage.metaDescription.value.toLowerCase();

    if (metaTitle.includes(primaryKeyword)) {
      checks.push("primary_keyword_in_meta_title");
    } else {
      warnings.push("Primary keyword is missing from meta title.");
    }

    if (metaDescription.includes(primaryKeyword)) {
      checks.push("primary_keyword_in_meta_description");
    } else {
      warnings.push("Primary keyword is missing from meta description.");
    }

    if (!/[!?]{2,}/u.test(productContentPackage.metaTitle.value + productContentPackage.metaDescription.value)) {
      checks.push("punctuation_is_restrained");
    } else {
      warnings.push("Metadata contains excessive punctuation.");
    }

    if (productContentPackage.slug.value.length > 0) {
      checks.push("slug_is_valid");
    }

    if (productContentPackage.h1.toLowerCase() !== productContentPackage.metaTitle.value.toLowerCase()) {
      checks.push("h1_is_distinct_from_meta_title");
    } else {
      warnings.push("H1 duplicates the meta title exactly.");
    }

    const readiness = {
      passed: warnings.length === 0,
      checks,
      warnings,
    };

    if (warnings.some((warning) => warning.includes("missing"))) {
      throw new InvalidSEOMetadataError("SEO metadata failed required quality checks.", {
        warnings,
      });
    }

    return readiness;
  }
}
