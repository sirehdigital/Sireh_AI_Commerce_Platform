import type { ContentSnapshot } from "../../domain/index.js";
import type { EmailContentPackage } from "../dto/email-content.types.js";

export interface EmailContentPackageSnapshot {
  readonly productId: string;
  readonly campaignType: string;
  readonly objective: string;
  readonly recommendedSubjectLine: string;
  readonly recommendedPreheader: string;
  readonly sequenceCount: number;
  readonly contents: readonly ContentSnapshot[];
  readonly generatedAt: Date;
}

export class EmailContentMapper {
  public toSnapshot(contentPackage: EmailContentPackage): EmailContentPackageSnapshot {
    return {
      productId: contentPackage.productId,
      campaignType: contentPackage.campaignType,
      objective: contentPackage.objective,
      recommendedSubjectLine: contentPackage.recommendedSubjectLine,
      recommendedPreheader: contentPackage.recommendedPreheader,
      sequenceCount: contentPackage.sequence.length,
      contents: contentPackage.contents.map((content) => content.snapshot()),
      generatedAt: new Date(contentPackage.generatedAt),
    };
  }
}
