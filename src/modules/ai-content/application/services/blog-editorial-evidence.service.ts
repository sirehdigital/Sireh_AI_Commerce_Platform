import type { BlogContentGenerationInput, BlogContentPackage } from "../dto/blog-content.types.js";
import { MissingBlogEvidenceError } from "../errors/product-content.errors.js";

export class BlogEditorialEvidenceService {
  public placeholders(input: BlogContentGenerationInput, contentPackage: BlogContentPackage): readonly string[] {
    const placeholders = [
      ...((input.verifiedResearchFacts ?? []).length === 0
        ? ["External source required before adding industry statistics, expert quotes or live market claims."]
        : []),
      ...contentPackage.sections
        .filter((section) => section.sourceEvidenceRequired)
        .map((section) => `Add approved evidence for section: ${section.heading}.`),
    ];

    return [...new Set(placeholders)];
  }

  public validate(input: BlogContentGenerationInput, contentPackage: BlogContentPackage): void {
    const fabricatedCitation = /\b(study published|according to experts|journal of|http:\/\/|https:\/\/)\b/iu.test(
      [contentPackage.introduction, contentPackage.conclusion, ...contentPackage.sections.flatMap((section) => section.paragraphs)].join(" "),
    );
    if (fabricatedCitation && (input.sourceReferences ?? []).length === 0) {
      throw new MissingBlogEvidenceError("Blog content appears to reference external evidence without supplied references.");
    }
  }
}
