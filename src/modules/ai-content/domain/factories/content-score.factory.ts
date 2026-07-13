import type { ContentScore } from "../types/content.types.js";
import { QualityScore } from "../value-objects/quality-score.value-object.js";

export interface ContentScoreFactoryInput {
  readonly overallQuality: number;
  readonly clarity?: number;
  readonly relevance?: number;
  readonly persuasiveness?: number;
  readonly readability?: number;
  readonly seoQuality?: number;
  readonly brandAlignment?: number;
  readonly channelSuitability?: number;
  readonly complianceRisk?: number;
  readonly evaluationNotes?: readonly string[];
}

export class ContentScoreFactory {
  public create(input: ContentScoreFactoryInput): ContentScore {
    return {
      overallQuality: QualityScore.create(input.overallQuality),
      evaluationNotes: [...(input.evaluationNotes ?? [])],
      ...(input.clarity === undefined ? {} : { clarity: QualityScore.create(input.clarity) }),
      ...(input.relevance === undefined ? {} : { relevance: QualityScore.create(input.relevance) }),
      ...(input.persuasiveness === undefined
        ? {}
        : { persuasiveness: QualityScore.create(input.persuasiveness) }),
      ...(input.readability === undefined ? {} : { readability: QualityScore.create(input.readability) }),
      ...(input.seoQuality === undefined ? {} : { seoQuality: QualityScore.create(input.seoQuality) }),
      ...(input.brandAlignment === undefined
        ? {}
        : { brandAlignment: QualityScore.create(input.brandAlignment) }),
      ...(input.channelSuitability === undefined
        ? {}
        : { channelSuitability: QualityScore.create(input.channelSuitability) }),
      ...(input.complianceRisk === undefined
        ? {}
        : { complianceRisk: QualityScore.create(input.complianceRisk) }),
    };
  }
}
