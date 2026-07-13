import type { ContentLocalizationInput } from "../dto/content-localization.types.js";

const PLACEHOLDER_PATTERN = /\{\{[a-zA-Z0-9_]+\}\}/gu;
const URL_PATTERN = /https?:\/\/[^\s)]+/gu;
const SKU_PATTERN = /\b[A-Z0-9]{3,}(?:-[A-Z0-9]{2,})+\b/gu;

export class ProtectedTermFactory {
  public create(input: ContentLocalizationInput): readonly string[] {
    return unique([
      ...input.protectedTerms,
      ...input.brandTerminology,
      ...input.productNames,
      ...input.brandNames,
      ...input.verifiedClaims,
      ...extract(input.headline, PLACEHOLDER_PATTERN),
      ...extract(input.headline, URL_PATTERN),
      ...extract(input.headline, SKU_PATTERN),
      ...extract(input.body, PLACEHOLDER_PATTERN),
      ...extract(input.body, URL_PATTERN),
      ...extract(input.body, SKU_PATTERN),
      ...(input.cta === undefined ? [] : extractAll(input.cta.value)),
      ...(input.seo?.canonicalReference === undefined ? [] : [input.seo.canonicalReference]),
      ...input.personalizationTokens,
      ...Object.values(input.structuredContent).flatMap((value) => [
        ...extract(value, PLACEHOLDER_PATTERN),
        ...extract(value, URL_PATTERN),
        ...extract(value, SKU_PATTERN),
      ]),
    ]);
  }

  public placeholders(input: ContentLocalizationInput): readonly string[] {
    return unique([
      ...input.personalizationTokens,
      ...extract(input.headline, PLACEHOLDER_PATTERN),
      ...extract(input.body, PLACEHOLDER_PATTERN),
      ...Object.values(input.structuredContent).flatMap((value) => extract(value, PLACEHOLDER_PATTERN)),
    ]);
  }
}

function extract(value: string, pattern: RegExp): readonly string[] {
  return value.match(pattern) ?? [];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) => right.length - left.length);
}

function extractAll(value: string): readonly string[] {
  return [...extract(value, PLACEHOLDER_PATTERN), ...extract(value, URL_PATTERN), ...extract(value, SKU_PATTERN)];
}
