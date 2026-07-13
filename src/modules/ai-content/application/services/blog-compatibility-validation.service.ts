import type { BlogContentGenerationInput, BlogContentGenerationOptions, BlogContentPackage } from "../dto/blog-content.types.js";
import {
  InvalidBlogSEOError,
  InvalidBlogStructureError,
  MissingBlogSourceError,
  UnsupportedBlogArticleTypeError,
} from "../errors/product-content.errors.js";
import { blogLengthRange } from "../factories/blog-content-options.factory.js";

export class BlogCompatibilityValidationService {
  public validateInput(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): void {
    if (options.articleType === "product-care-article" && (input.usageGuidance ?? []).length === 0) {
      throw new MissingBlogSourceError("Product-care articles require supplied usage guidance.");
    }
    if (options.articleType === "seasonal-article" && input.seasonOrEvent === undefined) {
      throw new UnsupportedBlogArticleTypeError("seasonal-article requires an explicit season or event.");
    }
    if (options.articleType === "trend-article" && input.trendContext === undefined) {
      throw new UnsupportedBlogArticleTypeError("trend-article requires explicit trend context.");
    }
  }

  public validatePackage(contentPackage: BlogContentPackage, options: BlogContentGenerationOptions): void {
    const sectionOrders = contentPackage.sections.map((section) => section.order);
    const duplicateOrders = sectionOrders.filter((order, index) => sectionOrders.indexOf(order) !== index);
    if (duplicateOrders.length > 0 || contentPackage.sections.length === 0) {
      throw new InvalidBlogStructureError("Blog sections must be ordered and non-empty.", { duplicateOrders });
    }

    if (options.includeFAQ && contentPackage.faqSection.length > options.faqCount) {
      throw new InvalidBlogStructureError("Blog FAQ count exceeds configured limit.", {
        expected: options.faqCount,
        actual: contentPackage.faqSection.length,
      });
    }

    if (options.strictSEOMode) {
      this.validateSEO(contentPackage);
    }

    const [minWords, maxWords] = blogLengthRange(options.articleLength);
    if (contentPackage.readingMetrics.estimatedWordCount < 1 || contentPackage.readingMetrics.targetRange[0] !== minWords) {
      throw new InvalidBlogStructureError("Blog reading metrics are inconsistent with article length.", {
        minWords,
        maxWords,
      });
    }
  }

  private validateSEO(contentPackage: BlogContentPackage): void {
    const titleIncludesKeyword = contentPackage.recommendedTitle
      .toLowerCase()
      .includes(contentPackage.primaryKeyword.toLowerCase().split(/\s+/u)[0] ?? "");
    if (contentPackage.primaryKeyword.trim().length === 0 || contentPackage.slug.trim().length === 0) {
      throw new InvalidBlogSEOError("Blog SEO metadata requires a primary keyword and slug.");
    }
    if (!titleIncludesKeyword && contentPackage.titleOptions.length === 0) {
      throw new InvalidBlogSEOError("Blog title options must remain SEO aware.");
    }
  }
}
