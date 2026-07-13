import type {
  ContentQualityScorecard,
  ContentQualityScoringInput,
  ContentQualityScoringOptionsInput,
} from "../dto/content-quality-scoring.types.js";
import { ContentQualityScoringInputFactory } from "../factories/content-quality-scoring-input.factory.js";
import { ContentQualityScoringOptionsFactory } from "../factories/content-quality-scoring-options.factory.js";
import type { ContentQualityScoringPort } from "../ports/content-quality-scoring.port.js";

export interface ScoreContentQualityUseCaseRequest {
  readonly input: ContentQualityScoringInput;
  readonly options?: ContentQualityScoringOptionsInput;
}

export class ScoreContentQualityUseCase {
  public constructor(
    private readonly scorer: ContentQualityScoringPort,
    private readonly inputFactory = new ContentQualityScoringInputFactory(),
    private readonly optionsFactory = new ContentQualityScoringOptionsFactory(),
  ) {}

  public execute(request: ScoreContentQualityUseCaseRequest): ContentQualityScorecard {
    const input = this.inputFactory.create(request.input);
    const options = this.optionsFactory.create({
      contentType: input.contentType,
      channel: input.channel,
      language: input.language,
      ...request.options,
    });

    return this.scorer.score(input, options);
  }
}
