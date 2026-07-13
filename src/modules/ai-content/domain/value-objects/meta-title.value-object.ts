import { InvalidContentValueError } from "../errors/content-domain.errors.js";
import { CONTENT_VALUE_LIMITS, normalizeSpacing } from "./content-value-limits.js";

export class MetaTitle {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): MetaTitle {
    const normalized = normalizeSpacing(value);

    if (normalized.length === 0) {
      throw new InvalidContentValueError("Meta title is required.");
    }

    if (normalized.length > CONTENT_VALUE_LIMITS.metaTitleMaxLength) {
      throw new InvalidContentValueError("Meta title exceeds the maximum length.", {
        maxLength: CONTENT_VALUE_LIMITS.metaTitleMaxLength,
      });
    }

    return new MetaTitle(normalized);
  }

  public equals(other: MetaTitle): boolean {
    return this.value === other.value;
  }
}
