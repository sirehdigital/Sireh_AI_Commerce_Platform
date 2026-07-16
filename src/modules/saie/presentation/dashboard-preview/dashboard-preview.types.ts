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
  readonly version: "v0.1.0 Alpha";
  readonly build: "SAIE-01.12";
  readonly environmentLabel: string;
  readonly systemOverview: {
    readonly engineStatus: "Operational";
    readonly safetyMode: "Human Approval Required";
    readonly executionMode: "Proposal Only";
    readonly shopifyIntegration: "Configured" | "Not Configured";
    readonly releaseChannel: "Alpha";
  };
  readonly heroBadges: readonly string[];
  readonly kpis: readonly DashboardKpiCard[];
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
    readonly version: "v0.1.0 Alpha";
    readonly build: "Build SAIE-01.12";
  };
  readonly executableActions: readonly [];
}
