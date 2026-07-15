import type { ProductPreparationBrandContext, ProductPreparationProposal } from "../workflows/product-preparation/index.js";
import type { ApprovalToken } from "./approval-token.js";

export type ControlledSafeUpdateExecutionMode = "controlled-safe-update";

export interface ControlledSafeUpdateExecutionRequest extends Readonly<Record<string, unknown>> {
  readonly executionMode: ControlledSafeUpdateExecutionMode;
  readonly approvedProposal: ProductPreparationProposal;
  readonly approvalToken: ApprovalToken;
  readonly productId: string;
  readonly storeDomain: `${string}.myshopify.com`;
  readonly brandContext: ProductPreparationBrandContext;
}
