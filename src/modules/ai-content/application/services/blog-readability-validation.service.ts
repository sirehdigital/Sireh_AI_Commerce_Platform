import type { BlogContentPackage, BlogWarning } from "../dto/blog-content.types.js";
import { BlogReadabilityError } from "../errors/product-content.errors.js";

export class BlogReadabilityValidationService {
  public inspect(contentPackage: BlogContentPackage): readonly BlogWarning[] {
    const warnings: BlogWarning[] = [];
    const paragraphLengths = contentPackage.sections.flatMap((section) =>
      section.paragraphs.map((paragraph) => paragraph.split(/\s+/u).length),
    );

    if (paragraphLengths.some((length) => length > 120)) {
      warnings.push({ code: "LONG_PARAGRAPH", message: "One or more blog paragraphs may be too long for editorial readability." });
    }
    if (contentPackage.sections.length < 3) {
      warnings.push({ code: "LOW_HEADING_FREQUENCY", message: "Blog article may need more headings for scanability." });
    }
    if (repetitionRate(contentPackage.sections.map((section) => section.heading)) > 0.3) {
      warnings.push({ code: "REPETITIVE_HEADINGS", message: "Blog headings repeat too frequently." });
    }
    if (/[!?]{3,}/u.test(contentPackage.introduction)) {
      warnings.push({ code: "EXCESSIVE_PUNCTUATION", message: "Blog introduction contains excessive punctuation." });
    }

    return warnings;
  }

  public validate(contentPackage: BlogContentPackage): void {
    const warnings = this.inspect(contentPackage);
    const blocking = warnings.filter((warning) => warning.code === "REPETITIVE_HEADINGS");
    if (blocking.length > 0) {
      throw new BlogReadabilityError("Blog readability validation failed.", { warnings: blocking });
    }
  }
}

function repetitionRate(values: readonly string[]): number {
  if (values.length === 0) {
    return 0;
  }
  return 1 - new Set(values.map((value) => value.toLowerCase())).size / values.length;
}
