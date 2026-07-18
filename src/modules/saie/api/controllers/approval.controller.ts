import type { RequestHandler } from "express";

import type {
  ApproveApprovalCommand,
  GetApprovalByIdQuery,
  ListApprovalsQuery,
  ProcessLocalMetricsRegistry,
  SaieLogger,
  RejectApprovalCommand,
} from "../../application/index.js";
import { getSaieCorrelationId, getSaieTenantContext } from "../middleware/index.js";
import { createDeterministicPaginationMeta } from "../contracts/index.js";
import { sendApplicationError, sendListSuccess, sendSuccess, sendValidationError, validateRouteId } from "./controller-helpers.js";

const MAX_DECISION_ACTOR_LENGTH = 120;
const MAX_DECISION_REASON_LENGTH = 500;

export interface ApprovalControllerDependencies {
  readonly listApprovals: ListApprovalsQuery;
  readonly getApprovalById: GetApprovalByIdQuery;
  readonly approveApproval: ApproveApprovalCommand;
  readonly rejectApproval: RejectApprovalCommand;
  readonly metrics?: ProcessLocalMetricsRegistry;
  readonly logger?: SaieLogger;
}

export interface ApprovalController {
  readonly listApprovals: RequestHandler;
  readonly getApproval: RequestHandler;
  readonly approveApproval: RequestHandler;
  readonly rejectApproval: RequestHandler;
}

export const createApprovalController = (
  dependencies: ApprovalControllerDependencies,
): ApprovalController => ({
  listApprovals: (request, response): void => {
    const approvals = dependencies.listApprovals.execute({ tenant: getSaieTenantContext(request) });
    sendListSuccess(response, approvals, createDeterministicPaginationMeta(approvals.length));
  },
  getApproval: (request, response): void => {
    const validation = validateRouteId(request.params.approvalId, "approvalId");
    if (!validation.valid) {
      sendValidationError(response, validation.details);
      return;
    }

    try {
      sendSuccess(response, dependencies.getApprovalById.execute({ tenant: getSaieTenantContext(request), id: validation.id }));
    } catch (error) {
      if (!sendApplicationError(response, error)) {
        throw error;
      }
    }
  },
  approveApproval: (request, response): void => {
    const correlationId = getSaieCorrelationId(request);
    const tenant = getSaieTenantContext(request);
    const validation = validateRouteId(request.params.approvalId, "approvalId");
    if (!validation.valid) {
      recordApprovalValidationFailure(dependencies, "approved", correlationId, tenant);
      sendValidationError(response, validation.details);
      return;
    }

    const bodyValidation = validateDecisionBody(request.body, false);
    if (!bodyValidation.valid) {
      recordApprovalValidationFailure(dependencies, "approved", correlationId, tenant);
      sendValidationError(response, bodyValidation.details);
      return;
    }

    try {
      sendSuccess(
        response,
        dependencies.approveApproval.execute({
          tenant,
          approvalId: validation.id,
          decidedBy: bodyValidation.decidedBy,
          ...(bodyValidation.reason === undefined ? {} : { reason: bodyValidation.reason }),
          ...(bodyValidation.expectedVersion === undefined
            ? {}
            : { expectedVersion: bodyValidation.expectedVersion }),
          ...(correlationId === undefined ? {} : { correlationId }),
        }),
      );
    } catch (error) {
      if (!sendApplicationError(response, error)) {
        throw error;
      }
    }
  },
  rejectApproval: (request, response): void => {
    const correlationId = getSaieCorrelationId(request);
    const tenant = getSaieTenantContext(request);
    const validation = validateRouteId(request.params.approvalId, "approvalId");
    if (!validation.valid) {
      recordApprovalValidationFailure(dependencies, "rejected", correlationId, tenant);
      sendValidationError(response, validation.details);
      return;
    }

    const bodyValidation = validateDecisionBody(request.body, true);
    if (!bodyValidation.valid) {
      recordApprovalValidationFailure(dependencies, "rejected", correlationId, tenant);
      sendValidationError(response, bodyValidation.details);
      return;
    }

    const rejectionReason = bodyValidation.reason;
    if (rejectionReason === undefined) {
      recordApprovalValidationFailure(dependencies, "rejected", correlationId, tenant);
      sendValidationError(response, [{ field: "reason", issue: "Reason is required for rejection." }]);
      return;
    }

    try {
      sendSuccess(
        response,
        dependencies.rejectApproval.execute({
          tenant,
          approvalId: validation.id,
          decidedBy: bodyValidation.decidedBy,
          reason: rejectionReason,
          ...(bodyValidation.expectedVersion === undefined
            ? {}
            : { expectedVersion: bodyValidation.expectedVersion }),
          ...(correlationId === undefined ? {} : { correlationId }),
        }),
      );
    } catch (error) {
      if (!sendApplicationError(response, error)) {
        throw error;
      }
    }
  },
});

const recordApprovalValidationFailure = (
  dependencies: ApprovalControllerDependencies,
  decision: "approved" | "rejected",
  correlationId: string | undefined,
  tenant: { readonly tenantId: string; readonly storeId: string },
): void => {
  dependencies.metrics?.incrementCounter("saie_approval_validation_failures_total", {
    decision,
    outcome: "failure",
  });
  dependencies.logger?.warn({
    eventName: "saie.approval.validation.failed",
    message: "Approval decision validation failed.",
    correlationId,
    operation: decision === "approved" ? "approval.approve" : "approval.reject",
    entityType: "approval",
    outcome: "failure",
    metadata: { decision, tenantId: tenant.tenantId, storeId: tenant.storeId },
  });
};

type DecisionBodyValidation =
  | {
      readonly valid: true;
      readonly decidedBy: string;
      readonly reason?: string;
      readonly expectedVersion?: number;
    }
  | {
      readonly valid: false;
      readonly details: readonly { readonly field: string; readonly issue: string }[];
    };

const validateDecisionBody = (body: unknown, reasonRequired: boolean): DecisionBodyValidation => {
  if (!isRecord(body)) {
    return {
      valid: false,
      details: [{ field: "body", issue: "Request body must be a JSON object." }],
    };
  }

  const details: { readonly field: string; readonly issue: string }[] = [];
  const decidedBy = normalizeBoundedString(body.decidedBy, "decidedBy", MAX_DECISION_ACTOR_LENGTH, details);
  const reason = normalizeOptionalBoundedString(body.reason, "reason", MAX_DECISION_REASON_LENGTH, details);
  const expectedVersion = normalizeExpectedVersion(body.expectedVersion, details);

  if (reasonRequired && reason === undefined) {
    details.push({ field: "reason", issue: "Reason is required for rejection." });
  }

  if (details.length > 0 || decidedBy === undefined) {
    return { valid: false, details };
  }

  return {
    valid: true,
    decidedBy,
    ...(reason === undefined ? {} : { reason }),
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeBoundedString = (
  value: unknown,
  field: string,
  maxLength: number,
  details: { readonly field: string; readonly issue: string }[],
): string | undefined => {
  if (typeof value !== "string") {
    details.push({ field, issue: "Value must be a string." });
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    details.push({ field, issue: "Value is required." });
    return undefined;
  }

  if (normalized.length > maxLength) {
    details.push({ field, issue: `Value must be ${maxLength} characters or fewer.` });
    return undefined;
  }

  return normalized;
};

const normalizeOptionalBoundedString = (
  value: unknown,
  field: string,
  maxLength: number,
  details: { readonly field: string; readonly issue: string }[],
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return normalizeBoundedString(value, field, maxLength, details);
};

const normalizeExpectedVersion = (
  value: unknown,
  details: { readonly field: string; readonly issue: string }[],
): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    details.push({ field: "expectedVersion", issue: "Expected version must be a positive integer." });
    return undefined;
  }

  return value;
};
