import type { BlogArticleLength, BlogReadingMetrics } from "../dto/blog-content.types.js";
import { blogLengthRange } from "./blog-content-options.factory.js";

export class BlogReadingMetricsFactory {
  public create(text: string, articleLength: BlogArticleLength): BlogReadingMetrics {
    const estimatedWordCount = wordCount(text);
    return {
      estimatedWordCount,
      estimatedReadingMinutes: Math.max(1, Math.ceil(estimatedWordCount / 220)),
      articleLength,
      targetRange: blogLengthRange(articleLength),
    };
  }
}

export function wordCount(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}
