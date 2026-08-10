import type {
  MarketingExecutionActionType,
  MarketingExecutionApprovalState,
  MarketingExecutionPayloadReference,
  MarketingExecutionSourceReference,
  MarketingExecutionTarget,
} from "../../domain/index.js";

export interface CreateMarketingExecutionRequestInput {
  readonly sourceReference: MarketingExecutionSourceReference;
  readonly actionType: MarketingExecutionActionType;
  readonly targetPlatform: MarketingExecutionTarget;
  readonly targetChannel: MarketingExecutionTarget;
  readonly payloadReference: MarketingExecutionPayloadReference;
  readonly requestedBy: string;
  readonly approvalRequirement?: MarketingExecutionApprovalState;
  readonly approvalId?: string;
  readonly createdAt: string;
}
