import { ContentDimensionScoreFactory, ContentQualityScorecardFactory, ContentScoringRuleFactory } from "../../application/factories/index.js";
import { evaluateRule } from "../../application/factories/content-scoring-rule.factory.js";
import type { ContentQualityScoringPort } from "../../application/ports/content-quality-scoring.port.js";
import type {
  ContentQualityScorecard,
  ContentQualityScoringInput,
  ContentQualityScoringOptions,
} from "../../application/dto/content-quality-scoring.types.js";

export class DeterministicContentQualityScoringEngine implements ContentQualityScoringPort {
  public constructor(
    private readonly ruleFactory = new ContentScoringRuleFactory(),
    private readonly dimensionFactory = new ContentDimensionScoreFactory(),
    private readonly scorecardFactory = new ContentQualityScorecardFactory(),
  ) {}

  public score(input: ContentQualityScoringInput, options: ContentQualityScoringOptions): ContentQualityScorecard {
    const evaluations = this.ruleFactory.create().map((definition) => evaluateRule(definition, input, options));
    const dimensionScores = this.dimensionFactory.create(evaluations, options.dimensionWeights);

    return this.scorecardFactory.create(input, options, dimensionScores, evaluations);
  }
}
