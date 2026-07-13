import type { Content } from "../../domain/index.js";
import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import { ContentQualityScoringInputFactory } from "../factories/content-quality-scoring-input.factory.js";

export class ContentAggregateToScoringInputMapper {
  public constructor(private readonly inputFactory = new ContentQualityScoringInputFactory()) {}

  public map(content: Content): ContentQualityScoringInput {
    return this.inputFactory.fromContent(content);
  }
}
