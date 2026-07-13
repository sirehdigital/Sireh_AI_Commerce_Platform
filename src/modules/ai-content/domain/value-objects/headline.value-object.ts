import { InvalidContentValueError } from "../errors/content-domain.errors.js";
import { CONTENT_VALUE_LIMITS, normalizeSpacing } from "./content-value-limits.js";

export class Headline {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): Headline {
    const normalized = normalizeSpacing(value);

    if (normalized.length < CONTENT_VALUE_LIMITS.headlineMinLength) {
      throw new InvalidContentValueError("Headline is too short.", {
        minLength: CONTENT_VALUE_LIMITS.headlineMinLength,
      });
    }

    if (normalized.length > CONTENT_VALUE_LIMITS.headlineMaxLength) {
      throw new InvalidContentValueError("Headline exceeds the maximum length.", {
        maxLength: CONTENT_VALUE_LIMITS.headlineMaxLength,
      });
    }

    return new Headline(normalized);
  }

  public equals(other: Headline): boolean {
    return this.value === other.value;
  }
}
