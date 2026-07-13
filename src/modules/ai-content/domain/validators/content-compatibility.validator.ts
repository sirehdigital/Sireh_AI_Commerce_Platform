import { IncompatibleContentChannelError } from "../errors/content-domain.errors.js";
import type { ContentChannel, ContentType } from "../types/content.types.js";

const CHANNEL_COMPATIBILITY: Record<ContentType, readonly ContentChannel[]> = {
  "product-title": ["shopify", "website", "generic"],
  "product-description": ["shopify", "website", "generic"],
  "product-benefits": ["shopify", "website", "generic"],
  "product-features": ["shopify", "website", "generic"],
  "landing-page-copy": ["website", "generic"],
  "seo-title": ["shopify", "website", "blog", "generic"],
  "seo-description": ["shopify", "website", "blog", "generic"],
  "social-post": ["facebook", "instagram", "tiktok", "linkedin", "x", "generic"],
  "social-caption": ["facebook", "instagram", "tiktok", "linkedin", "x", "youtube", "generic"],
  "video-script": ["youtube", "tiktok", "instagram", "generic"],
  "email-subject": ["email", "generic"],
  "email-body": ["email", "generic"],
  "blog-article": ["blog", "website", "generic"],
  cta: ["shopify", "website", "email", "facebook", "instagram", "tiktok", "youtube", "generic"],
  "generic-content": [
    "shopify",
    "website",
    "blog",
    "email",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "linkedin",
    "x",
    "generic",
  ],
};

export class ContentCompatibilityValidator {
  public isCompatible(type: ContentType, channel: ContentChannel): boolean {
    return CHANNEL_COMPATIBILITY[type].includes(channel);
  }

  public assertCompatible(type: ContentType, channel: ContentChannel): void {
    if (!this.isCompatible(type, channel)) {
      throw new IncompatibleContentChannelError("Content type is not compatible with channel.", {
        type,
        channel,
      });
    }
  }
}
