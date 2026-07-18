import type { RequestHandler } from "express";

import type { GetExecutionByIdQuery, ListExecutionsQuery } from "../../application/index.js";
import { getSaieTenantContext } from "../middleware/index.js";
import { createDeterministicPaginationMeta } from "../contracts/index.js";
import { sendApplicationError, sendListSuccess, sendSuccess, sendValidationError, validateRouteId } from "./controller-helpers.js";

export interface ExecutionControllerDependencies {
  readonly listExecutions: ListExecutionsQuery;
  readonly getExecutionById: GetExecutionByIdQuery;
}

export interface ExecutionController {
  readonly listExecutions: RequestHandler;
  readonly getExecution: RequestHandler;
}

export const createExecutionController = (
  dependencies: ExecutionControllerDependencies,
): ExecutionController => ({
  listExecutions: (request, response): void => {
    const executions = dependencies.listExecutions.execute({ tenant: getSaieTenantContext(request) });
    sendListSuccess(response, executions, createDeterministicPaginationMeta(executions.length));
  },
  getExecution: (request, response): void => {
    const validation = validateRouteId(request.params.executionId, "executionId");
    if (!validation.valid) {
      sendValidationError(response, validation.details);
      return;
    }

    try {
      sendSuccess(response, dependencies.getExecutionById.execute({ tenant: getSaieTenantContext(request), id: validation.id }));
    } catch (error) {
      if (!sendApplicationError(response, error)) {
        throw error;
      }
    }
  },
});
