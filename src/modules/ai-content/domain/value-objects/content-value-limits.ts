export const CONTENT_VALUE_LIMITS = {
  headlineMinLength: 3,
  headlineMaxLength: 120,
  ctaMaxLength: 80,
  keywordMaxLength: 80,
  metaTitleMaxLength: 60,
  metaDescriptionMaxLength: 160,
  slugMaxLength: 120,
  qualityScoreMin: 0,
  qualityScoreMax: 100,
} as const;

export function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}
