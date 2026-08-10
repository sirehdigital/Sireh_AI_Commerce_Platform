import type { MarketingExecutionRequest, MarketingExecutionReadiness } from "../../domain/index.js";

export interface MarketingExecutionAdapterSupport {
  readonly supported: boolean;
  readonly reason: string;
}

export interface MarketingExecutionPreparation {
  readonly requestId: string;
  readonly readiness: MarketingExecutionReadiness;
  readonly externalExecutionAllowed: false;
}

export interface MarketingExecutionAdapter {
  canSupport(request: MarketingExecutionRequest): MarketingExecutionAdapterSupport;
  prepare(request: MarketingExecutionRequest): MarketingExecutionPreparation;
  execute(request: MarketingExecutionRequest): never;
}
