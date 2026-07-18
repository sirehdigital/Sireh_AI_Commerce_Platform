export type DashboardStatusTone = "operational" | "ready" | "planned" | "disabled";

export interface DashboardAgentStatus {
  readonly name: string;
  readonly status: string;
  readonly tone: DashboardStatusTone;
}

export interface DashboardKpiCard {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface DashboardOperationsSummaryItem {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export type DashboardProposalStatus = "READY_FOR_REVIEW" | "NEEDS_INPUT" | "BLOCKED";

export interface DashboardProposalQueueItem {
  readonly proposalType: string;
  readonly originatingAgent: string;
  readonly status: DashboardProposalStatus;
  readonly readiness: string;
  readonly approvalRequirement: string;
  readonly lastPreviewUpdate: string;
}

export interface DashboardAgentActivityItem {
  readonly agent: string;
  readonly activityType: string;
  readonly status: DashboardProposalStatus;
  readonly previewTimestamp: string;
}

export type DashboardSystemHealthStatus = "HEALTHY" | "READY" | "LIMITED" | "PLANNED";

export interface DashboardSystemHealthItem {
  readonly component: string;
  readonly status: DashboardSystemHealthStatus;
  readonly note: string;
}

export interface DashboardNotificationItem {
  readonly title: string;
  readonly detail: string;
}

export interface DashboardRiskItem {
  readonly limitation: string;
  readonly impact: string;
}

export interface DashboardAgentCapability {
  readonly name: string;
  readonly status: string;
  readonly capability: string;
  readonly currentMode: string;
  readonly readiness: string;
  readonly tone: DashboardStatusTone;
}

export interface DashboardIntegrationStatus {
  readonly name: string;
  readonly status: "Existing integration" | "Configured" | "Not Configured" | "Planned";
  readonly tone: DashboardStatusTone;
}

export interface DashboardIntegrationGroup {
  readonly name: "Available" | "Existing" | "Planned";
  readonly integrations: readonly DashboardIntegrationStatus[];
}

export interface DashboardApprovalCenter {
  readonly title: "Approval Center Preview";
  readonly items: readonly string[];
}

export interface DashboardReleaseTimelineItem {
  readonly label: string;
  readonly status: "Complete" | "Current";
}

export interface DashboardViewModel {
  readonly engineName: "Sireh AI Engine";
  readonly subtitle: "Enterprise AI Operating System";
  readonly tagline: "Building the Future with AI";
  readonly version: "v0.2.0 Beta";
  readonly build: "SAIE-02.10";
  readonly environmentLabel: string;
  readonly systemOverview: {
    readonly engineStatus: "Operational";
    readonly safetyMode: "Human Approval Required";
    readonly executionMode: "Proposal Only";
    readonly shopifyIntegration: "Configured" | "Not Configured";
    readonly releaseChannel: "Beta";
  };
  readonly heroBadges: readonly string[];
  readonly navigation: readonly string[];
  readonly kpis: readonly DashboardKpiCard[];
  readonly operationsSummary: readonly DashboardOperationsSummaryItem[];
  readonly proposalQueue: readonly DashboardProposalQueueItem[];
  readonly agentActivity: readonly DashboardAgentActivityItem[];
  readonly systemHealth: readonly DashboardSystemHealthItem[];
  readonly notifications: readonly DashboardNotificationItem[];
  readonly executiveRisks: readonly DashboardRiskItem[];
  readonly agents: readonly DashboardAgentStatus[];
  readonly agentCapabilities: readonly DashboardAgentCapability[];
  readonly workflowSteps: readonly string[];
  readonly architectureSteps: readonly string[];
  readonly approvalCenter: DashboardApprovalCenter;
  readonly safetyControls: readonly string[];
  readonly integrations: readonly DashboardIntegrationStatus[];
  readonly integrationGroups: readonly DashboardIntegrationGroup[];
  readonly releaseTimeline: readonly DashboardReleaseTimelineItem[];
  readonly footer: {
    readonly company: "Sireh Digital";
    readonly poweredBy: "Powered by SAIE";
    readonly version: "v0.2.0 Beta";
    readonly build: "Build SAIE-02.10";
  };
  readonly executableActions: readonly [];
}
