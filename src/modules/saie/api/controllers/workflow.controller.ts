import type { RequestHandler } from "express";

import type { GetWorkflowByIdQuery, ListWorkflowsQuery } from "../../application/index.js";
import { getSaieTenantContext } from "../middleware/index.js";
import { createDeterministicPaginationMeta } from "../contracts/index.js";
import { sendApplicationError, sendListSuccess, sendSuccess, sendValidationError, validateRouteId } from "./controller-helpers.js";

export interface WorkflowControllerDependencies {
  readonly listWorkflows: ListWorkflowsQuery;
  readonly getWorkflowById: GetWorkflowByIdQuery;
}

export interface WorkflowController {
  readonly listWorkflows: RequestHandler;
  readonly getWorkflow: RequestHandler;
}

export const createWorkflowController = (
  dependencies: WorkflowControllerDependencies,
): WorkflowController => ({
  listWorkflows: (request, response): void => {
    const workflows = dependencies.listWorkflows.execute({ tenant: getSaieTenantContext(request) });
    sendListSuccess(response, workflows, createDeterministicPaginationMeta(workflows.length));
  },
  getWorkflow: (request, response): void => {
    const validation = validateRouteId(request.params.workflowId, "workflowId");
    if (!validation.valid) {
      sendValidationError(response, validation.details);
      return;
    }

    try {
      sendSuccess(response, dependencies.getWorkflowById.execute({ tenant: getSaieTenantContext(request), id: validation.id }));
    } catch (error) {
      if (!sendApplicationError(response, error)) {
        throw error;
      }
    }
  },
});
