import type { RequestHandler } from "express";

import type { GetMetricsQuery } from "../../application/index.js";
import { sendSuccess } from "./controller-helpers.js";

export interface MetricsControllerDependencies {
  readonly getMetrics: GetMetricsQuery;
}

export interface MetricsController {
  readonly getMetrics: RequestHandler;
}

export const createMetricsController = (
  dependencies: MetricsControllerDependencies,
): MetricsController => ({
  getMetrics: (_request, response): void => {
    sendSuccess(response, dependencies.getMetrics.execute());
  },
});
