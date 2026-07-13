import { InvalidContentValueError } from "../errors/content-domain.errors.js";
import { CONTENT_VALUE_LIMITS, normalizeSpacing } from "./content-value-limits.js";

export class SEOKeyword {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): SEOKeyword {
    const normalized = normalizeSpacing(value).toLowerCase();

    if (normalized.length === 0) {
      throw new InvalidContentValueError("SEO keyword is required.");
    }

    if (normalized.length > CONTENT_VALUE_LIMITS.keywordMaxLength) {
      throw new InvalidContentValueError("SEO keyword exceeds the maximum length.", {
        maxLength: CONTENT_VALUE_LIMITS.keywordMaxLength,
      });
    }

    return new SEOKeyword(normalized);
  }

  public equals(other: SEOKeyword): boolean {
    return this.value === other.value;
  }
}
