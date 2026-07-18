import type { RequestHandler } from "express";

import type { GetHealthQuery } from "../../application/index.js";
import { sendSuccess } from "./controller-helpers.js";

export interface HealthControllerDependencies {
  readonly getHealth: GetHealthQuery;
}

export interface HealthController {
  readonly getHealth: RequestHandler;
}

export const createHealthController = (
  dependencies: HealthControllerDependencies,
): HealthController => ({
  getHealth: (_request, response): void => {
    sendSuccess(response, dependencies.getHealth.execute());
  },
});
