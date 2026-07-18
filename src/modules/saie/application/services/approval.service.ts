import { ApplicationNotFoundError } from "../errors/index.js";
import type { ApprovalRecord, ApprovalRepository } from "../repositories/index.js";
import type { TenantContext } from "../tenant/index.js";

export interface ApproveApprovalInput {
  readonly tenant: TenantContext;
  readonly approvalId: string;
  readonly decidedBy: string;
  readonly reason?: string;
  readonly expectedVersion?: number;
  readonly correlationId?: string;
}

export interface RejectApprovalInput {
  readonly tenant: TenantContext;
  readonly approvalId: string;
  readonly decidedBy: string;
  readonly reason: string;
  readonly expectedVersion?: number;
  readonly correlationId?: string;
}

export class InvalidApprovalTransitionError extends Error {
  public constructor(
    public readonly approvalId: string,
    public readonly currentStatus: ApprovalRecord["status"],
  ) {
    super(`Approval ${approvalId} cannot transition from ${currentStatus}.`);
    this.name = "InvalidApprovalTransitionError";
  }
}

export class ApprovalService {
  public constructor(
    private readonly approvalRepository: ApprovalRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public approve(input: ApproveApprovalInput): ApprovalRecord {
    const approval = this.findPendingApproval(input.tenant, input.approvalId);

    return this.approvalRepository.save(
      input.tenant,
      {
        ...approval,
        status: "approved",
        decidedAt: this.now().toISOString(),
        decidedBy: input.decidedBy,
        ...(input.reason === undefined ? {} : { decisionReason: input.reason }),
        executionEnabled: false,
        requiresHumanApproval: true,
        source: "human-decision",
        version: approval.version + 1,
      },
      input.expectedVersion ?? approval.version,
    );
  }

  public reject(input: RejectApprovalInput): ApprovalRecord {
    const approval = this.findPendingApproval(input.tenant, input.approvalId);

    return this.approvalRepository.save(
      input.tenant,
      {
        ...approval,
        status: "rejected",
        decidedAt: this.now().toISOString(),
        decidedBy: input.decidedBy,
        decisionReason: input.reason,
        executionEnabled: false,
        requiresHumanApproval: true,
        source: "human-decision",
        version: approval.version + 1,
      },
      input.expectedVersion ?? approval.version,
    );
  }

  private findPendingApproval(tenant: TenantContext, approvalId: string): ApprovalRecord {
    const approval = this.approvalRepository.findById(tenant, approvalId);

    if (approval === undefined) {
      throw new ApplicationNotFoundError("Approval", approvalId);
    }

    if (approval.status !== "pending") {
      throw new InvalidApprovalTransitionError(approval.id, approval.status);
    }

    return approval;
  }
}
