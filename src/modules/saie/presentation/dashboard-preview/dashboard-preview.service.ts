import type { DashboardViewModel } from "./dashboard-preview.types.js";

export class DashboardPreviewService {
  public createViewModel(environment: NodeJS.ProcessEnv = process.env): DashboardViewModel {
    return {
      engineName: "Sireh AI Engine",
      subtitle: "Enterprise AI Operating System",
      version: "v0.1.0 Alpha",
      build: "SAIE-01.11 Dashboard Preview",
      environmentLabel: this.safeEnvironmentLabel(environment.NODE_ENV),
      systemOverview: {
        engineStatus: "Operational",
        safetyMode: "Human Approval Required",
        executionMode: "Proposal Only",
        shopifyIntegration: this.isShopifyConfigured(environment) ? "Configured" : "Not Configured",
        releaseChannel: "Alpha",
      },
      agents: [
        { name: "Product Agent", status: "Ready", tone: "ready" },
        { name: "Marketing Agent", status: "Planner Only", tone: "operational" },
        { name: "Content Agent", status: "Planner Only", tone: "operational" },
        { name: "Executive Orchestrator", status: "Ready for Review", tone: "ready" },
        { name: "Analytics Agent", status: "Planned", tone: "planned" },
        { name: "CEO Dashboard", status: "Planned", tone: "planned" },
      ],
      workflowSteps: [
        "Product Context",
        "Marketing Proposal",
        "Content Proposal",
        "Executive Consolidation",
        "Human Approval",
        "STOP",
      ],
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
      ],
      footer: {
        company: "Sireh Digital",
        tagline: "Building the Future with AI",
        poweredBy: "Powered by SAIE",
        version: "v0.1.0 Alpha",
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
