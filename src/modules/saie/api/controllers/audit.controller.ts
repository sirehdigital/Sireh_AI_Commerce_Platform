import type { RequestHandler } from "express";

import type { GetAuditByIdQuery, ListAuditsQuery } from "../../application/index.js";
import { getSaieTenantContext } from "../middleware/index.js";
import { createDeterministicPaginationMeta } from "../contracts/index.js";
import { sendApplicationError, sendListSuccess, sendSuccess, sendValidationError, validateRouteId } from "./controller-helpers.js";

export interface AuditControllerDependencies {
  readonly listAudits: ListAuditsQuery;
  readonly getAuditById: GetAuditByIdQuery;
}

export interface AuditController {
  readonly listAudits: RequestHandler;
  readonly getAudit: RequestHandler;
}

export const createAuditController = (
  dependencies: AuditControllerDependencies,
): AuditController => ({
  listAudits: (request, response): void => {
    const audits = dependencies.listAudits.execute({ tenant: getSaieTenantContext(request) });
    sendListSuccess(response, audits, createDeterministicPaginationMeta(audits.length));
  },
  getAudit: (request, response): void => {
    const validation = validateRouteId(request.params.auditId, "auditId");
    if (!validation.valid) {
      sendValidationError(response, validation.details);
      return;
    }

    try {
      sendSuccess(response, dependencies.getAuditById.execute({ tenant: getSaieTenantContext(request), id: validation.id }));
    } catch (error) {
      if (!sendApplicationError(response, error)) {
        throw error;
      }
    }
  },
});
