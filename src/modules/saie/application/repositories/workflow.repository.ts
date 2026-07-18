import type { WorkflowReadModel } from "../models/index.js";
import type { TenantContext } from "../tenant/index.js";

export type WorkflowRecord = WorkflowReadModel;

export interface WorkflowRepository {
  readonly list: (context: TenantContext) => readonly WorkflowRecord[];
  readonly findById: (context: TenantContext, workflowId: string) => WorkflowRecord | undefined;
}
