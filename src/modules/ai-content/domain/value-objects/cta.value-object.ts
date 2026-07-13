import { InvalidContentValueError } from "../errors/content-domain.errors.js";
import { CONTENT_VALUE_LIMITS, normalizeSpacing } from "./content-value-limits.js";

export class CTA {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): CTA {
    const normalized = normalizeSpacing(value);

    if (normalized.length === 0) {
      throw new InvalidContentValueError("CTA text is required.");
    }

    if (normalized.length > CONTENT_VALUE_LIMITS.ctaMaxLength) {
      throw new InvalidContentValueError("CTA text exceeds the maximum length.", {
        maxLength: CONTENT_VALUE_LIMITS.ctaMaxLength,
      });
    }

    return new CTA(normalized);
  }

  public equals(other: CTA): boolean {
    return this.value === other.value;
  }
}
