import { InvalidContentValueError } from "../errors/content-domain.errors.js";
import type { ContentSnapshot } from "../types/content.types.js";
import { ContentCompatibilityValidator } from "./content-compatibility.validator.js";
import { ContentSEOValidator } from "./content-seo.validator.js";

const BODY_REQUIRED_TYPES = new Set<ContentSnapshot["type"]>([
  "product-description",
  "landing-page-copy",
  "social-post",
  "social-caption",
  "video-script",
  "email-body",
  "blog-article",
  "generic-content",
]);

const CTA_REQUIRED_TYPES = new Set<ContentSnapshot["type"]>(["cta"]);

export class ContentAggregateValidator {
  public constructor(
    private readonly compatibilityValidator = new ContentCompatibilityValidator(),
    private readonly seoValidator = new ContentSEOValidator(),
  ) {}

  public assertValid(snapshot: ContentSnapshot): void {
    this.compatibilityValidator.assertCompatible(snapshot.type, snapshot.channel);
    this.seoValidator.assertValid(snapshot.type, snapshot.seo);

    if (BODY_REQUIRED_TYPES.has(snapshot.type) && snapshot.body.trim().length === 0) {
      throw new InvalidContentValueError("Content body is required for this content type.", {
        type: snapshot.type,
      });
    }

    if (CTA_REQUIRED_TYPES.has(snapshot.type) && snapshot.cta === undefined) {
      throw new InvalidContentValueError("CTA is required for CTA content.", {
        type: snapshot.type,
      });
    }

    if (snapshot.revision < 1) {
      throw new InvalidContentValueError("Content revision must be at least 1.");
    }
  }
}
