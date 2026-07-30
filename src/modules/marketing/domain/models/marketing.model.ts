export type CampaignStatus =
  | "DRAFT"
  | "PLANNED"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "COMPLETED"
  | "CANCELLED";

export type MarketingGoalType =
  | "BRAND_AWARENESS"
  | "TRAFFIC"
  | "ENGAGEMENT"
  | "LEAD_GENERATION"
  | "SALES"
  | "RETENTION"
  | "UPSELL"
  | "CROSS_SELL";

export type MarketingChannelType =
  | "SHOPIFY"
  | "EMAIL"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "THREADS"
  | "PINTEREST"
  | "BLOG";

export type MarketingWorkflowStage =
  | "Draft"
  | "Planning"
  | "Review"
  | "Approval"
  | "Scheduling"
  | "Publishing"
  | "Monitoring"
  | "Completion";

export type MarketingContentType =
  | "PRODUCT_DESCRIPTION"
  | "SHORT_DESCRIPTION"
  | "HEADLINE"
  | "HOOK"
  | "CALL_TO_ACTION"
  | "BENEFITS"
  | "FEATURES"
  | "FAQ"
  | "EMAIL_SUBJECT"
  | "EMAIL_BODY"
  | "BLOG_OUTLINE"
  | "META_TITLE"
  | "META_DESCRIPTION"
  | "KEYWORDS"
  | "SOCIAL_CAPTION"
  | "HASHTAGS";

export type MarketingContentVariant =
  | "SHORT"
  | "MEDIUM"
  | "LONG"
  | "PROFESSIONAL"
  | "FRIENDLY"
  | "LUXURY"
  | "MINIMAL";

export type MarketingContentWorkflowState =
  | "Draft"
  | "Generate"
  | "Review"
  | "Approve"
  | "Ready For Publishing";

export interface MarketingGoal {
  readonly type: MarketingGoalType;
  readonly description: string;
  readonly targetMetric: string;
}

export interface MarketingAudience {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly segments: readonly string[];
  readonly markets: readonly string[];
}

export interface MarketingChannel {
  readonly type: MarketingChannelType;
  readonly priority: "PRIMARY" | "SECONDARY";
  readonly enabled: boolean;
}

export interface ContentPlan {
  readonly requirements: readonly string[];
  readonly contentTypes: readonly string[];
  readonly copyGenerationAllowed: false;
}

export interface PublishingPlan {
  readonly requirements: readonly string[];
  readonly publishingAllowed: false;
  readonly schedulingExecutionAllowed: false;
}

export interface CampaignSchedule {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
}

export interface CampaignBudget {
  readonly amount: number;
  readonly currency: string;
  readonly allocationNotes: readonly string[];
}

export interface MarketingWorkflow {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly name: string;
  readonly stages: readonly MarketingWorkflowStage[];
  readonly currentStage: MarketingWorkflowStage;
  readonly approvalRequired: boolean;
  readonly executionEnabled: false;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarketingStrategy {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly campaignId?: string;
  readonly name: string;
  readonly goal: MarketingGoal;
  readonly audience: MarketingAudience;
  readonly primaryChannel: MarketingChannelType;
  readonly secondaryChannels: readonly MarketingChannelType[];
  readonly positioning: string;
  readonly contentRequirements: readonly string[];
  readonly publishingRequirements: readonly string[];
  readonly approvalRequired: boolean;
  readonly executionReadiness: "NOT_READY" | "READY_FOR_REVIEW";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "ERROR" | "WARNING";
  readonly path: string;
}

export interface CampaignValidationReport {
  readonly errors: readonly CampaignValidationIssue[];
  readonly warnings: readonly CampaignValidationIssue[];
  readonly approvalRequired: boolean;
  readonly executionReady: boolean;
}

export interface MarketingContentValidationReport {
  readonly errors: readonly CampaignValidationIssue[];
  readonly warnings: readonly CampaignValidationIssue[];
  readonly approvalRequired: boolean;
  readonly readyForReview: boolean;
}

export interface MarketingContentSection {
  readonly type: MarketingContentType;
  readonly title: string;
  readonly body: string;
  readonly keywords: readonly string[];
}

export interface MarketingGeneratedContent {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly campaignId?: string;
  readonly strategyId?: string;
  readonly name: string;
  readonly channel: MarketingChannelType;
  readonly goalType: MarketingGoalType;
  readonly audience: MarketingAudience;
  readonly variant: MarketingContentVariant;
  readonly contentTypes: readonly MarketingContentType[];
  readonly sections: readonly MarketingContentSection[];
  readonly workflowState: MarketingContentWorkflowState;
  readonly approvalId?: string;
  readonly validation: MarketingContentValidationReport;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarketingContentListQuery {
  readonly tenantId?: string;
  readonly storeId?: string;
  readonly campaignId?: string;
  readonly channel?: MarketingChannelType;
  readonly workflowState?: MarketingContentWorkflowState;
  readonly limit?: number;
  readonly offset?: number;
}

export interface MarketingContentListResult {
  readonly items: readonly MarketingGeneratedContent[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}

export interface MarketingCampaign {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly goal: MarketingGoal;
  readonly audience: MarketingAudience;
  readonly channels: readonly MarketingChannel[];
  readonly strategyId?: string;
  readonly workflowId?: string;
  readonly publishingPlan: PublishingPlan;
  readonly contentPlan: ContentPlan;
  readonly schedule: CampaignSchedule;
  readonly budget: CampaignBudget;
  readonly approvalId?: string;
  readonly validation: CampaignValidationReport;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignPlanningResult {
  readonly campaignId: string;
  readonly campaignGoal: MarketingGoal;
  readonly audience: MarketingAudience;
  readonly primaryChannel: MarketingChannelType;
  readonly secondaryChannels: readonly MarketingChannelType[];
  readonly contentRequirements: readonly string[];
  readonly publishingRequirements: readonly string[];
  readonly approvalRequired: boolean;
  readonly executionReadiness: "NOT_READY" | "READY_FOR_REVIEW";
  readonly validation: CampaignValidationReport;
}

export interface MarketingCampaignListQuery {
  readonly tenantId?: string;
  readonly storeId?: string;
  readonly status?: CampaignStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface MarketingCampaignListResult {
  readonly items: readonly MarketingCampaign[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly nextOffset?: number;
}
