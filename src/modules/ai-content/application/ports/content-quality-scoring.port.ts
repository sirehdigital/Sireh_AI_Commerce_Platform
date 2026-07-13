import type {
  ContentQualityScorecard,
  ContentQualityScoringInput,
  ContentQualityScoringOptions,
} from "../dto/content-quality-scoring.types.js";

export interface ContentQualityScoringPort {
  score(input: ContentQualityScoringInput, options: ContentQualityScoringOptions): ContentQualityScorecard;
}
