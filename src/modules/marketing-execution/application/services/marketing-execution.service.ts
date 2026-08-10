import { AppError } from "../../../../shared/errors/app-error.js";
import type { CreateMarketingExecutionRequestInput } from "../dto/create-marketing-execution-request.js";
import type { MarketingExecutionRepository } from "../../domain/index.js";
import {
  MARKETING_EXECUTION_ACTION_TYPES,
  MARKETING_EXECUTION_APPROVAL_STATES,
  MARKETING_EXECUTION_READINESS_STATES,
  MARKETING_EXECUTION_SOURCE_TYPES,
  MARKETING_EXECUTION_STATUSES,
  MARKETING_EXECUTION_VERSION,
  type MarketingExecutionActionType,
  type MarketingExecutionApprovalState,
  type MarketingExecutionReadiness,
  type MarketingExecutionRequest,
  type MarketingExecutionSourceType,
  type MarketingExecutionStatus,
  type MarketingExecutionTarget,
  type MarketingExecutionValidationIssue,
} from "../../domain/index.js";

const TARGETS: readonly MarketingExecutionTarget[] = ["SHOPIFY", "EMAIL", "FACEBOOK", "INSTAGRAM", "TIKTOK", "THREADS", "PINTEREST", "BLOG", "OTHER"];
const APPROVAL_REQUIRED_ACTIONS: readonly MarketingExecutionActionType[] = ["PUBLISH_CONTENT", "SCHEDULE_CONTENT", "PAUSE_CONTENT", "RESUME_CONTENT", "REMOVE_CONTENT"];

const VALID_TRANSITIONS: Readonly<Record<MarketingExecutionStatus, readonly MarketingExecutionStatus[]>> = {
  DRAFT: ["PENDING_APPROVAL", "READY", "BLOCKED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "BLOCKED", "CANCELLED"],
  APPROVED: ["READY", "BLOCKED", "CANCELLED"],
  REJECTED: [],
  READY: ["BLOCKED", "CANCELLED"],
  BLOCKED: [],
  CANCELLED: [],
};

export class MarketingExecutionService {
  public constructor(private readonly repository: MarketingExecutionRepository) {}

  public async create(input: CreateMarketingExecutionRequestInput): Promise<MarketingExecutionRequest> {
    const normalized = this.normalizeInput(input);
    const validationIssues = this.validateNormalizedInput(normalized);
    if (validationIssues.length > 0) {
      throw AppError.badRequest("Marketing execution request is invalid.", { issues: validationIssues }, "MARKETING_EXECUTION_REQUEST_INVALID");
    }

    const request = this.buildRequest(normalized);
    return this.repository.save(request);
  }

  public async transition(executionRequestId: string, nextStatus: MarketingExecutionStatus, updatedAt: string): Promise<MarketingExecutionRequest> {
    const request = await this.repository.findById(required(executionRequestId, "executionRequestId"));
    if (request === undefined) {
      throw AppError.notFound("Marketing execution request was not found.", { executionRequestId }, "MARKETING_EXECUTION_REQUEST_NOT_FOUND");
    }

    const normalizedNext = this.executionStatus(nextStatus);
    if (!VALID_TRANSITIONS[request.executionStatus].includes(normalizedNext)) {
      throw AppError.conflict(
        "Marketing execution status transition is invalid.",
        { executionRequestId, currentStatus: request.executionStatus, nextStatus: normalizedNext },
        "MARKETING_EXECUTION_INVALID_TRANSITION",
      );
    }

    const approvalRequirement = this.approvalForTransition(request.approvalRequirement, normalizedNext);
    const transitioned: MarketingExecutionRequest = {
      ...request,
      approvalRequirement,
      executionStatus: normalizedNext,
      updatedAt: isoTimestamp(updatedAt, "updatedAt"),
    };
    const readiness = this.evaluateReadiness(transitioned);
    return this.repository.save({ ...transitioned, readiness });
  }

  public evaluateReadiness(request: MarketingExecutionRequest): MarketingExecutionReadiness {
    const issues = this.validateRequest(request);
    if (issues.length > 0) {
      return {
        state: "INVALID",
        executable: false,
        reason: "Execution request has validation errors.",
        issues,
      };
    }

    if (request.executionStatus === "BLOCKED" || request.executionStatus === "CANCELLED" || request.approvalRequirement === "REJECTED" || request.executionStatus === "REJECTED") {
      return {
        state: "BLOCKED",
        executable: false,
        reason: "Execution request is blocked, cancelled, or rejected.",
        issues: [],
      };
    }

    if (request.approvalRequirement === "REQUIRED" || request.executionStatus === "PENDING_APPROVAL") {
      return {
        state: "WAITING_FOR_APPROVAL",
        executable: false,
        reason: "Human approval is required before this request can become ready.",
        issues: [],
      };
    }

    if (request.executionStatus === "DRAFT" || request.executionStatus === "APPROVED") {
      return {
        state: "BLOCKED",
        executable: false,
        reason: "Execution request is valid but not yet marked ready.",
        issues: [],
      };
    }

    if (request.executionStatus === "READY" && (request.approvalRequirement === "APPROVED" || request.approvalRequirement === "NOT_REQUIRED")) {
      return {
        state: "READY",
        executable: false,
        reason: "Request is governance-ready for a future execution adapter; external execution remains disabled in SACP-04.05A.",
        issues: [],
      };
    }

    return {
      state: "INVALID",
      executable: false,
      reason: "Execution request lifecycle and approval state are not aligned.",
      issues: [issue("MARKETING_EXECUTION_LIFECYCLE_INVALID", "Lifecycle and approval state are not executable-ready.", "executionStatus")],
    };
  }

  private buildRequest(input: NormalizedMarketingExecutionRequestInput): MarketingExecutionRequest {
    const approvalRequirement = this.resolveApprovalRequirement(input.actionType, input.approvalRequirement);
    const status = approvalRequirement === "REQUIRED" ? "PENDING_APPROVAL" : "DRAFT";
    const base: Omit<MarketingExecutionRequest, "readiness"> = {
      executionRequestId: this.executionRequestId(input),
      sourceReference: {
        sourceType: input.sourceReference.sourceType,
        sourceId: input.sourceReference.sourceId,
      },
      sourceType: input.sourceReference.sourceType,
      actionType: input.actionType,
      targetPlatform: input.targetPlatform,
      targetChannel: input.targetChannel,
      payloadReference: {
        payloadId: input.payloadReference.payloadId,
        summary: input.payloadReference.summary,
        ...(input.payloadReference.metadata === undefined ? {} : { metadata: { ...input.payloadReference.metadata } }),
      },
      requestedBy: input.requestedBy,
      actor: { requestedBy: input.requestedBy },
      approvalRequirement,
      ...(input.approvalId === undefined ? {} : { approvalId: input.approvalId }),
      executionStatus: status,
      advisoryOnly: true,
      executionEnabled: false,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      metadata: {
        version: MARKETING_EXECUTION_VERSION,
        identityRule: "marketing-execution:<source-type>:<source-id>:<action>:<platform>:<channel>",
        externalExecutionBoundary: "CONTRACT_ONLY_NO_PLATFORM_ADAPTER",
      },
    };

    return { ...base, readiness: this.evaluateReadiness({ ...base, readiness: pendingReadiness() }) };
  }

  private resolveApprovalRequirement(actionType: MarketingExecutionActionType, requestedApproval: MarketingExecutionApprovalState | undefined): MarketingExecutionApprovalState {
    if (requestedApproval === undefined) {
      return APPROVAL_REQUIRED_ACTIONS.includes(actionType) ? "REQUIRED" : "NOT_REQUIRED";
    }

    if (requestedApproval === "NOT_REQUIRED" && APPROVAL_REQUIRED_ACTIONS.includes(actionType)) {
      throw AppError.badRequest("This marketing execution action requires approval.", { actionType }, "MARKETING_EXECUTION_APPROVAL_REQUIRED");
    }

    if (requestedApproval === "APPROVED" || requestedApproval === "REJECTED") {
      throw AppError.badRequest("Approval decision states cannot be supplied during request creation.", { requestedApproval }, "MARKETING_EXECUTION_APPROVAL_STATE_INVALID");
    }

    return requestedApproval;
  }

  private approvalForTransition(current: MarketingExecutionApprovalState, nextStatus: MarketingExecutionStatus): MarketingExecutionApprovalState {
    if (nextStatus === "APPROVED") {
      if (current !== "REQUIRED") {
        throw AppError.conflict("Only required approvals can transition to approved.", { current }, "MARKETING_EXECUTION_APPROVAL_TRANSITION_INVALID");
      }
      return "APPROVED";
    }

    if (nextStatus === "REJECTED") {
      return "REJECTED";
    }

    if (nextStatus === "READY" && current !== "APPROVED" && current !== "NOT_REQUIRED") {
      throw AppError.conflict("Request cannot become ready without approved or not-required approval state.", { current }, "MARKETING_EXECUTION_READY_REQUIRES_APPROVAL");
    }

    return current;
  }

  private normalizeInput(input: CreateMarketingExecutionRequestInput): NormalizedMarketingExecutionRequestInput {
    return {
      sourceReference: {
        sourceType: this.sourceType(input.sourceReference?.sourceType),
        sourceId: required(input.sourceReference?.sourceId, "sourceReference.sourceId"),
      },
      actionType: this.actionType(input.actionType),
      targetPlatform: this.target(input.targetPlatform, "targetPlatform"),
      targetChannel: this.target(input.targetChannel, "targetChannel"),
      payloadReference: {
        payloadId: required(input.payloadReference?.payloadId, "payloadReference.payloadId"),
        summary: required(input.payloadReference?.summary, "payloadReference.summary"),
        ...(input.payloadReference?.metadata === undefined ? {} : { metadata: { ...input.payloadReference.metadata } }),
      },
      requestedBy: required(input.requestedBy, "requestedBy"),
      ...(input.approvalRequirement === undefined ? {} : { approvalRequirement: this.approvalState(input.approvalRequirement) }),
      ...(input.approvalId === undefined ? {} : { approvalId: required(input.approvalId, "approvalId") }),
      createdAt: isoTimestamp(input.createdAt, "createdAt"),
    };
  }

  private validateNormalizedInput(input: NormalizedMarketingExecutionRequestInput): readonly MarketingExecutionValidationIssue[] {
    const issues: MarketingExecutionValidationIssue[] = [];
    if (input.sourceReference.sourceId.length < 3) {
      issues.push(issue("MARKETING_EXECUTION_SOURCE_ID_INVALID", "Source reference must contain at least 3 characters.", "sourceReference.sourceId"));
    }
    if (input.payloadReference.payloadId.length < 3) {
      issues.push(issue("MARKETING_EXECUTION_PAYLOAD_ID_INVALID", "Payload reference must contain at least 3 characters.", "payloadReference.payloadId"));
    }
    if (input.targetPlatform === "OTHER" && input.targetChannel !== "OTHER") {
      issues.push(issue("MARKETING_EXECUTION_TARGET_INVALID", "OTHER platform must use OTHER channel.", "targetPlatform"));
    }
    return issues;
  }

  private validateRequest(request: MarketingExecutionRequest): readonly MarketingExecutionValidationIssue[] {
    const issues: MarketingExecutionValidationIssue[] = [];
    if (!MARKETING_EXECUTION_SOURCE_TYPES.includes(request.sourceType) || request.sourceType !== request.sourceReference.sourceType) {
      issues.push(issue("MARKETING_EXECUTION_SOURCE_INVALID", "Source type is invalid or inconsistent.", "sourceType"));
    }
    if (!MARKETING_EXECUTION_ACTION_TYPES.includes(request.actionType)) {
      issues.push(issue("MARKETING_EXECUTION_ACTION_INVALID", "Action type is invalid.", "actionType"));
    }
    if (!TARGETS.includes(request.targetPlatform) || !TARGETS.includes(request.targetChannel)) {
      issues.push(issue("MARKETING_EXECUTION_TARGET_INVALID", "Target platform or channel is invalid.", "target"));
    }
    if (!MARKETING_EXECUTION_APPROVAL_STATES.includes(request.approvalRequirement)) {
      issues.push(issue("MARKETING_EXECUTION_APPROVAL_INVALID", "Approval requirement is invalid.", "approvalRequirement"));
    }
    if (!MARKETING_EXECUTION_STATUSES.includes(request.executionStatus)) {
      issues.push(issue("MARKETING_EXECUTION_STATUS_INVALID", "Execution status is invalid.", "executionStatus"));
    }
    if (!MARKETING_EXECUTION_READINESS_STATES.includes(request.readiness.state)) {
      issues.push(issue("MARKETING_EXECUTION_READINESS_INVALID", "Readiness state is invalid.", "readiness.state"));
    }
    if (request.approvalRequirement === "REQUIRED" && request.executionStatus === "READY") {
      issues.push(issue("MARKETING_EXECUTION_READY_REQUIRES_APPROVAL", "Required approval must be approved before ready.", "approvalRequirement"));
    }
    return issues;
  }

  private executionRequestId(input: NormalizedMarketingExecutionRequestInput): string {
    return [
      "marketing-execution",
      normalizeIdentityPart(input.sourceReference.sourceType),
      normalizeIdentityPart(input.sourceReference.sourceId),
      normalizeIdentityPart(input.actionType),
      normalizeIdentityPart(input.targetPlatform),
      normalizeIdentityPart(input.targetChannel),
    ].join(":");
  }

  private sourceType(value: unknown): MarketingExecutionSourceType {
    if (typeof value !== "string" || !MARKETING_EXECUTION_SOURCE_TYPES.includes(value as MarketingExecutionSourceType)) {
      throw AppError.badRequest("Marketing execution source type is invalid.", { value }, "MARKETING_EXECUTION_SOURCE_INVALID");
    }
    return value as MarketingExecutionSourceType;
  }

  private actionType(value: unknown): MarketingExecutionActionType {
    if (typeof value !== "string" || !MARKETING_EXECUTION_ACTION_TYPES.includes(value as MarketingExecutionActionType)) {
      throw AppError.badRequest("Marketing execution action type is invalid.", { value }, "MARKETING_EXECUTION_ACTION_INVALID");
    }
    return value as MarketingExecutionActionType;
  }

  private target(value: unknown, field: string): MarketingExecutionTarget {
    if (typeof value !== "string" || !TARGETS.includes(value as MarketingExecutionTarget)) {
      throw AppError.badRequest("Marketing execution target is invalid.", { field, value }, "MARKETING_EXECUTION_TARGET_INVALID");
    }
    return value as MarketingExecutionTarget;
  }

  private approvalState(value: unknown): MarketingExecutionApprovalState {
    if (typeof value !== "string" || !MARKETING_EXECUTION_APPROVAL_STATES.includes(value as MarketingExecutionApprovalState)) {
      throw AppError.badRequest("Marketing execution approval state is invalid.", { value }, "MARKETING_EXECUTION_APPROVAL_INVALID");
    }
    return value as MarketingExecutionApprovalState;
  }

  private executionStatus(value: unknown): MarketingExecutionStatus {
    if (typeof value !== "string" || !MARKETING_EXECUTION_STATUSES.includes(value as MarketingExecutionStatus)) {
      throw AppError.badRequest("Marketing execution status is invalid.", { value }, "MARKETING_EXECUTION_STATUS_INVALID");
    }
    return value as MarketingExecutionStatus;
  }
}

interface NormalizedMarketingExecutionRequestInput {
  readonly sourceReference: {
    readonly sourceType: MarketingExecutionSourceType;
    readonly sourceId: string;
  };
  readonly actionType: MarketingExecutionActionType;
  readonly targetPlatform: MarketingExecutionTarget;
  readonly targetChannel: MarketingExecutionTarget;
  readonly payloadReference: {
    readonly payloadId: string;
    readonly summary: string;
    readonly metadata?: Readonly<Record<string, string | number | boolean>>;
  };
  readonly requestedBy: string;
  readonly approvalRequirement?: MarketingExecutionApprovalState;
  readonly approvalId?: string;
  readonly createdAt: string;
}

function required(value: string | undefined, field: string): string {
  const text = value?.trim();
  if (text === undefined || text.length === 0) {
    throw AppError.badRequest("Required marketing execution field is missing.", { field }, "MARKETING_EXECUTION_REQUIRED_FIELD_MISSING");
  }
  return text;
}

function isoTimestamp(value: string, field: string): string {
  const text = required(value, field);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== text) {
    throw AppError.badRequest("Marketing execution timestamp must be strict ISO UTC.", { field }, "MARKETING_EXECUTION_TIMESTAMP_INVALID");
  }
  return text;
}

function normalizeIdentityPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
}

function issue(code: string, message: string, path: string): MarketingExecutionValidationIssue {
  return { code, message, path };
}

function pendingReadiness(): MarketingExecutionReadiness {
  return {
    state: "INVALID",
    executable: false,
    reason: "Readiness has not been evaluated.",
    issues: [],
  };
}

export const MARKETING_EXECUTION_TARGETS: readonly MarketingExecutionTarget[] = TARGETS;
