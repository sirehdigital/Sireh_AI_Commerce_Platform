import type { DashboardViewModel } from "./dashboard-preview.types.js";

export class DashboardPreviewService {
  public createViewModel(environment: NodeJS.ProcessEnv = process.env): DashboardViewModel {
    return {
      engineName: "Sireh AI Engine",
      subtitle: "Enterprise AI Operating System",
      tagline: "Building the Future with AI",
      version: "v0.1.0 Alpha",
      build: "SAIE-01.12",
      environmentLabel: this.safeEnvironmentLabel(environment.NODE_ENV),
      systemOverview: {
        engineStatus: "Operational",
        safetyMode: "Human Approval Required",
        executionMode: "Proposal Only",
        shopifyIntegration: this.isShopifyConfigured(environment) ? "Configured" : "Not Configured",
        releaseChannel: "Alpha",
      },
      heroBadges: ["Operational", "Human Approval Required", "Proposal Only"],
      kpis: [
        { label: "Active Agents", value: "4", detail: "Product, Marketing, Content, Executive" },
        { label: "Planning Agents", value: "3", detail: "Marketing, Content, Executive" },
        { label: "Operational Integrations", value: "1", detail: "Shopify backend integration" },
        { label: "Planned Integrations", value: "8", detail: "Automation landscape roadmap" },
        { label: "Safety Mode", value: "Human Required", detail: "Approval gate remains mandatory" },
        { label: "Execution Mode", value: "Proposal Only", detail: "Executable actions disabled" },
      ],
      agents: [
        { name: "Product Agent", status: "Ready", tone: "ready" },
        { name: "Marketing Agent", status: "Planner Only", tone: "operational" },
        { name: "Content Agent", status: "Planner Only", tone: "operational" },
        { name: "Executive Orchestrator", status: "Ready for Review", tone: "ready" },
        { name: "Analytics Agent", status: "Planned", tone: "planned" },
        { name: "CEO Dashboard", status: "Planned", tone: "planned" },
      ],
      agentCapabilities: [
        {
          name: "Product Agent",
          status: "Ready",
          capability: "Product context planning",
          currentMode: "Plan only",
          readiness: "Ready",
          tone: "ready",
        },
        {
          name: "Marketing Agent",
          status: "Planner Only",
          capability: "Campaign proposal planning",
          currentMode: "Proposal only",
          readiness: "Human review required",
          tone: "operational",
        },
        {
          name: "Content Agent",
          status: "Planner Only",
          capability: "Content proposal planning",
          currentMode: "Proposal only",
          readiness: "Human review required",
          tone: "operational",
        },
        {
          name: "Executive Orchestrator",
          status: "Ready for Review",
          capability: "Cross-agent consolidation",
          currentMode: "Read-only preview",
          readiness: "Ready for review",
          tone: "ready",
        },
        {
          name: "Analytics Agent",
          status: "Planned",
          capability: "Performance intelligence",
          currentMode: "Not connected",
          readiness: "Planned",
          tone: "planned",
        },
        {
          name: "CEO Dashboard",
          status: "Planned",
          capability: "Executive command view",
          currentMode: "Not connected",
          readiness: "Planned",
          tone: "planned",
        },
      ],
      workflowSteps: [
        "Product Context",
        "Marketing Proposal",
        "Content Proposal",
        "Executive Consolidation",
        "Human Approval",
        "STOP",
      ],
      architectureSteps: [
        "User / Shopify",
        "SAIE Enterprise Dashboard",
        "Executive Orchestrator",
        "Product Agent",
        "Marketing Agent",
        "Content Agent",
        "Human Approval",
        "STOP",
      ],
      approvalCenter: {
        title: "Approval Center Preview",
        items: [
          "Human approval required",
          "No pending live approvals",
          "Approval execution unavailable in Alpha",
          "No action buttons",
        ],
      },
      safetyControls: [
        "No automatic publishing",
        "No automatic advertising",
        "No automatic email delivery",
        "No automatic Shopify mutation",
        "Human approval required",
        "Executable actions disabled",
      ],
      integrations: [
        { name: "Shopify", status: "Existing integration", tone: "ready" },
        { name: "AutoDS", status: "Planned", tone: "planned" },
        { name: "Meta", status: "Planned", tone: "planned" },
        { name: "TikTok", status: "Planned", tone: "planned" },
        { name: "Amazon", status: "Planned", tone: "planned" },
        { name: "eBay", status: "Planned", tone: "planned" },
        { name: "Gmail", status: "Planned", tone: "planned" },
        { name: "Canva", status: "Planned", tone: "planned" },
        { name: "GitHub automation", status: "Planned", tone: "planned" },
      ],
      integrationGroups: [
        { name: "Available", integrations: [] },
        {
          name: "Existing",
          integrations: [{ name: "Shopify backend integration", status: "Existing integration", tone: "ready" }],
        },
        {
          name: "Planned",
          integrations: [
            { name: "AutoDS", status: "Planned", tone: "planned" },
            { name: "Meta", status: "Planned", tone: "planned" },
            { name: "TikTok", status: "Planned", tone: "planned" },
            { name: "Amazon", status: "Planned", tone: "planned" },
            { name: "eBay", status: "Planned", tone: "planned" },
            { name: "Gmail", status: "Planned", tone: "planned" },
            { name: "Canva", status: "Planned", tone: "planned" },
            { name: "GitHub automation", status: "Planned", tone: "planned" },
          ],
        },
      ],
      releaseTimeline: [
        { label: "SAIE-01 Foundation", status: "Complete" },
        { label: "SAIE-01.08 Marketing Agent", status: "Complete" },
        { label: "SAIE-01.09 Content Agent", status: "Complete" },
        { label: "SAIE-01.10 Executive Orchestrator", status: "Complete" },
        { label: "SAIE-01.11 Dashboard Preview", status: "Complete" },
        { label: "SAIE-01.12 Enterprise Landing Dashboard", status: "Current" },
      ],
      footer: {
        company: "Sireh Digital",
        poweredBy: "Powered by SAIE",
        version: "v0.1.0 Alpha",
        build: "Build SAIE-01.12",
      },
      executableActions: [],
    };
  }

  private safeEnvironmentLabel(nodeEnv: string | undefined): string {
    if (nodeEnv === "production") {
      return "Production";
    }

    if (nodeEnv === "test") {
      return "Test";
    }

    return "Development";
  }

  private isShopifyConfigured(environment: NodeJS.ProcessEnv): boolean {
    return (
      this.hasValue(environment.SHOPIFY_API_KEY) &&
      this.hasValue(environment.SHOPIFY_API_SECRET) &&
      this.hasValue(environment.SHOPIFY_APP_URL)
    );
  }

  private hasValue(value: string | undefined): boolean {
    return value !== undefined && value.trim().length > 0;
  }
}

export const dashboardPreviewService = new DashboardPreviewService();
