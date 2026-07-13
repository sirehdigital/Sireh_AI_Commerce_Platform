import { InvalidContentValueError } from "../errors/content-domain.errors.js";
import { CONTENT_VALUE_LIMITS, normalizeSpacing } from "./content-value-limits.js";

export class MetaDescription {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): MetaDescription {
    const normalized = normalizeSpacing(value);

    if (normalized.length === 0) {
      throw new InvalidContentValueError("Meta description is required.");
    }

    if (normalized.length > CONTENT_VALUE_LIMITS.metaDescriptionMaxLength) {
      throw new InvalidContentValueError("Meta description exceeds the maximum length.", {
        maxLength: CONTENT_VALUE_LIMITS.metaDescriptionMaxLength,
      });
    }

    return new MetaDescription(normalized);
  }

  public equals(other: MetaDescription): boolean {
    return this.value === other.value;
  }
}
