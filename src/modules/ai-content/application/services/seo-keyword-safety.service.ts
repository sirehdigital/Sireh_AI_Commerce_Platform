import type { SEOKeywordSet } from "../dto/seo-content.types.js";
import { UnsafeSEOKeywordError } from "../errors/product-content.errors.js";

const UNSAFE_KEYWORD_PATTERNS: readonly RegExp[] = [
  /\b(cure|treatment|disease|medical grade)\b/iu,
  /\b(guaranteed|rank #1|top ranking|instant results)\b/iu,
  /\b(near me|in new york|in london|in malaysia)\b/iu,
  /\b(casino|adult|crypto)\b/iu,
  /\b(best best|cheap cheap)\b/iu,
];

export class SEOKeywordSafetyService {
  public validateKeywordSet(keywordSet: SEOKeywordSet): void {
    const keywords = [
      keywordSet.primaryKeyword,
      ...keywordSet.secondaryKeywords,
      ...keywordSet.longTailKeywords,
      ...keywordSet.semanticVariants,
    ];
    const unsafe = keywords
      .map((keyword) => keyword.value)
      .filter((keyword) => this.inspectKeyword(keyword).length > 0);

    if (unsafe.length > 0) {
      throw new UnsafeSEOKeywordError("SEO keywords contain unsupported or unsafe terms.", {
        keywords: unsafe,
      });
    }
  }

  public inspectKeyword(keyword: string): readonly string[] {
    const normalized = keyword.toLowerCase();
    const repeatedWords = normalized.split(/\s+/u).filter((word, index, words) => words.indexOf(word) !== index);
    const findings = UNSAFE_KEYWORD_PATTERNS.filter((pattern) => pattern.test(normalized)).map((pattern) =>
      pattern.source,
    );

    if (repeatedWords.length > 1) {
      return [...findings, "keyword_stuffing"];
    }

    return findings;
  }
}
