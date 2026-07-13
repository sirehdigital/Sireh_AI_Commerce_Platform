import type { LocalizedContentPackage } from "../dto/content-localization.types.js";

export interface LocalizedContentPackageSnapshot {
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly readiness: string;
  readonly localizedHeadline: string;
  readonly contentCount: number;
  readonly reviewRequiredCount: number;
  readonly localizedAt: Date;
}

export class LocalizedContentMapper {
  public toSnapshot(contentPackage: LocalizedContentPackage): LocalizedContentPackageSnapshot {
    return {
      sourceLocale: contentPackage.sourceLocale,
      targetLocale: contentPackage.targetLocale,
      readiness: contentPackage.readiness,
      localizedHeadline: contentPackage.localizedHeadline,
      contentCount: contentPackage.contents.length,
      reviewRequiredCount: contentPackage.reviewRequiredItems.length,
      localizedAt: new Date(contentPackage.localizedAt),
    };
  }
}
