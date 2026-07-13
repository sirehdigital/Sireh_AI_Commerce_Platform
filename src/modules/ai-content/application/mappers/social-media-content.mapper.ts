import type { ContentSnapshot } from "../../domain/index.js";
import type { SocialMediaContentPackage } from "../dto/social-media-content.types.js";

export interface SocialMediaContentPackageSnapshot {
  readonly productId: string;
  readonly platform: string;
  readonly objective: string;
  readonly contentAngle: string;
  readonly hook: string;
  readonly primaryCaption: string;
  readonly hashtags: readonly string[];
  readonly contents: readonly ContentSnapshot[];
  readonly generatedAt: Date;
}

export class SocialMediaContentMapper {
  public toSnapshot(contentPackage: SocialMediaContentPackage): SocialMediaContentPackageSnapshot {
    return {
      productId: contentPackage.productId,
      platform: contentPackage.platform,
      objective: contentPackage.objective,
      contentAngle: contentPackage.contentAngle,
      hook: contentPackage.hook,
      primaryCaption: contentPackage.primaryCaption,
      hashtags: [...contentPackage.hashtags],
      contents: contentPackage.contents.map((content) => content.snapshot()),
      generatedAt: new Date(contentPackage.generatedAt),
    };
  }
}
