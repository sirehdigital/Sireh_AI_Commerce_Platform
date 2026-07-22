import type {
  ProductCandidate,
  ScoredProductCandidate,
} from "../../domain/models/product-candidate.model.js";
import { ProductCandidateScoringService } from "./product-candidate-scoring.service.js";

export interface RankProductCandidatesOptions {
  readonly limit?: number;
}

export class ProductHunterRankingService {
  public constructor(private readonly scoringService = new ProductCandidateScoringService()) {}

  public rank(
    candidates: readonly ProductCandidate[],
    options: RankProductCandidatesOptions = {},
  ): readonly ScoredProductCandidate[] {
    const rankedCandidates = candidates
      .map((candidate) => this.scoringService.score(candidate))
      .sort((first, second) => {
        if (second.winningScore !== first.winningScore) {
          return second.winningScore - first.winningScore;
        }

        return second.financials.estimatedProfit.amount - first.financials.estimatedProfit.amount;
      });

    return options.limit === undefined ? rankedCandidates : rankedCandidates.slice(0, options.limit);
  }
}
