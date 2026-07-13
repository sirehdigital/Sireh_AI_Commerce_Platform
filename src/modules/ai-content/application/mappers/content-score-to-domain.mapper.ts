import type { ContentScore } from "../../domain/index.js";
import type { ContentQualityScorecard } from "../dto/content-quality-scoring.types.js";

export class ContentScoreToDomainMapper {
  public map(scorecard: ContentQualityScorecard): ContentScore {
    return scorecard.contentScore;
  }
}
