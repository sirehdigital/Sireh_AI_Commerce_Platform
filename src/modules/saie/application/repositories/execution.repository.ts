import type { ExecutionReadModel } from "../models/index.js";
import type { TenantContext } from "../tenant/index.js";

export type ExecutionRecord = ExecutionReadModel;

export interface ExecutionRepository {
  readonly list: (context: TenantContext) => readonly ExecutionRecord[];
  readonly findById: (context: TenantContext, executionId: string) => ExecutionRecord | undefined;
  readonly findByApprovalId: (context: TenantContext, approvalId: string) => ExecutionRecord | undefined;
  readonly append: (context: TenantContext, record: ExecutionRecord) => ExecutionRecord;
}
