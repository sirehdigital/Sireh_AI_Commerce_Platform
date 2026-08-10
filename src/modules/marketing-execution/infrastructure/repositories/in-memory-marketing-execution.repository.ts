import type { MarketingExecutionRepository, MarketingExecutionRequest } from "../../domain/index.js";

export class InMemoryMarketingExecutionRepository implements MarketingExecutionRepository {
  private readonly requests = new Map<string, MarketingExecutionRequest>();

  public save(request: MarketingExecutionRequest): Promise<MarketingExecutionRequest> {
    this.requests.set(request.executionRequestId, structuredClone(request));
    return Promise.resolve(structuredClone(request));
  }

  public findById(executionRequestId: string): Promise<MarketingExecutionRequest | undefined> {
    const request = this.requests.get(executionRequestId);
    return Promise.resolve(request === undefined ? undefined : structuredClone(request));
  }

  public list(): Promise<readonly MarketingExecutionRequest[]> {
    return Promise.resolve([...this.requests.values()].sort((left, right) => left.executionRequestId.localeCompare(right.executionRequestId)).map((request) => structuredClone(request)));
  }
}
