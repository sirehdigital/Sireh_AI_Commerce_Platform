import { InvalidContentValueError } from "../errors/content-domain.errors.js";
import { CONTENT_VALUE_LIMITS } from "./content-value-limits.js";

export class Slug {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): Slug {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/gu, "-")
      .replace(/[^a-z0-9-]/gu, "")
      .replace(/-+/gu, "-")
      .replace(/^-|-$/gu, "");

    if (normalized.length === 0) {
      throw new InvalidContentValueError("Slug must contain at least one supported character.");
    }

    if (normalized.length > CONTENT_VALUE_LIMITS.slugMaxLength) {
      throw new InvalidContentValueError("Slug exceeds the maximum length.", {
        maxLength: CONTENT_VALUE_LIMITS.slugMaxLength,
      });
    }

    return new Slug(normalized);
  }

  public equals(other: Slug): boolean {
    return this.value === other.value;
  }
}
