import type { ContentSEO, ContentSearchIntent } from "../types/content.types.js";
import { MetaDescription } from "../value-objects/meta-description.value-object.js";
import { MetaTitle } from "../value-objects/meta-title.value-object.js";
import { SEOKeyword } from "../value-objects/seo-keyword.value-object.js";
import { Slug } from "../value-objects/slug.value-object.js";

export interface ContentSEOFactoryInput {
  readonly primaryKeyword?: string;
  readonly secondaryKeywords?: readonly string[];
  readonly metaTitle?: string;
  readonly metaDescription?: string;
  readonly slug?: string;
  readonly searchIntent?: ContentSearchIntent;
  readonly canonicalReference?: string;
  readonly indexable?: boolean;
}

export class ContentSEOFactory {
  public create(input: ContentSEOFactoryInput): ContentSEO {
    return {
      secondaryKeywords: (input.secondaryKeywords ?? []).map((keyword) => SEOKeyword.create(keyword)),
      indexable: input.indexable ?? true,
      ...(input.primaryKeyword === undefined
        ? {}
        : { primaryKeyword: SEOKeyword.create(input.primaryKeyword) }),
      ...(input.metaTitle === undefined ? {} : { metaTitle: MetaTitle.create(input.metaTitle) }),
      ...(input.metaDescription === undefined
        ? {}
        : { metaDescription: MetaDescription.create(input.metaDescription) }),
      ...(input.slug === undefined ? {} : { slug: Slug.create(input.slug) }),
      ...(input.searchIntent === undefined ? {} : { searchIntent: input.searchIntent }),
      ...(input.canonicalReference === undefined
        ? {}
        : { canonicalReference: input.canonicalReference.trim() }),
    };
  }
}
