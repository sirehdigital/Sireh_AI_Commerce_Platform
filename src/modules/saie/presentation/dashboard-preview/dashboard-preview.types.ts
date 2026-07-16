export type DashboardStatusTone = "operational" | "ready" | "planned" | "disabled";

export interface DashboardAgentStatus {
  readonly name: string;
  readonly status: string;
  readonly tone: DashboardStatusTone;
}

export interface DashboardIntegrationStatus {
  readonly name: string;
  readonly status: "Existing integration" | "Configured" | "Not Configured" | "Planned";
  readonly tone: DashboardStatusTone;
}

export interface DashboardViewModel {
  readonly engineName: "Sireh AI Engine";
  readonly subtitle: "Enterprise AI Operating System";
  readonly version: "v0.1.0 Alpha";
  readonly build: "SAIE-01.11 Dashboard Preview";
  readonly environmentLabel: string;
  readonly systemOverview: {
    readonly engineStatus: "Operational";
    readonly safetyMode: "Human Approval Required";
    readonly executionMode: "Proposal Only";
    readonly shopifyIntegration: "Configured" | "Not Configured";
    readonly releaseChannel: "Alpha";
  };
  readonly agents: readonly DashboardAgentStatus[];
  readonly workflowSteps: readonly string[];
  readonly safetyControls: readonly string[];
  readonly integrations: readonly DashboardIntegrationStatus[];
  readonly footer: {
    readonly company: "Sireh Digital";
    readonly tagline: "Building the Future with AI";
    readonly poweredBy: "Powered by SAIE";
    readonly version: "v0.1.0 Alpha";
  };
  readonly executableActions: readonly [];
}
