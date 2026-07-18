import type { ApprovalReadModel } from "../models/index.js";
import type { TenantContext } from "../tenant/index.js";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalRecord = ApprovalReadModel;

export interface ApprovalRepository {
  readonly list: (context: TenantContext) => readonly ApprovalRecord[];
  readonly findById: (context: TenantContext, approvalId: string) => ApprovalRecord | undefined;
  readonly save: (context: TenantContext, approval: ApprovalRecord, expectedVersion?: number) => ApprovalRecord;
}

export class ApprovalVersionConflictError extends Error {
  public constructor(approvalId: string) {
    super(`Approval ${approvalId} has a conflicting version.`);
    this.name = "ApprovalVersionConflictError";
  }
}
