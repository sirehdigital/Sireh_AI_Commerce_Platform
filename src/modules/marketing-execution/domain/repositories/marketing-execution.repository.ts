import type { MarketingExecutionRequest } from "../models/marketing-execution.model.js";

export interface MarketingExecutionRepository {
  save(request: MarketingExecutionRequest): Promise<MarketingExecutionRequest>;
  findById(executionRequestId: string): Promise<MarketingExecutionRequest | undefined>;
  list(): Promise<readonly MarketingExecutionRequest[]>;
}
