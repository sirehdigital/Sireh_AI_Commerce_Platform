import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { dashboardPreviewRouter } from "./dashboard-preview.controller.js";
import { DashboardPreviewService } from "./dashboard-preview.service.js";
import { renderDashboardPreviewHtml } from "./dashboard-preview.template.js";

describe("DashboardPreviewService", () => {
  it("creates a deterministic SAIE-01.12 landing dashboard view model", () => {
    const viewModel = new DashboardPreviewService().createViewModel({
      NODE_ENV: "production",
      SHOPIFY_API_KEY: "secret-key",
      SHOPIFY_API_SECRET: "secret-secret",
      SHOPIFY_APP_URL: "https://app.example.com",
    });

    expect(viewModel).toMatchObject({
      engineName: "Sireh AI Engine",
      subtitle: "Enterprise AI Operating System",
      tagline: "Building the Future with AI",
      version: "v0.1.0 Alpha",
      build: "SAIE-01.12",
      environmentLabel: "Production",
      systemOverview: {
        engineStatus: "Operational",
        safetyMode: "Human Approval Required",
        executionMode: "Proposal Only",
        shopifyIntegration: "Configured",
        releaseChannel: "Alpha",
      },
      executableActions: [],
    });
  });

  it("represents hero metadata and deterministic KPI cards without live commercial metrics", () => {
    const viewModel = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" });

    expect(viewModel.heroBadges).toEqual(["Operational", "Human Approval Required", "Proposal Only"]);
    expect(viewModel.kpis.map((kpi) => kpi.label)).toEqual([
      "Active Agents",
      "Planning Agents",
      "Operational Integrations",
      "Planned Integrations",
      "Safety Mode",
      "Execution Mode",
    ]);
    expect(JSON.stringify(viewModel.kpis)).not.toMatch(/revenue|orders|customers/iu);
  });

  it("represents the full agent capability matrix", () => {
    const capabilities = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }).agentCapabilities;

    expect(capabilities.map((agent) => agent.name)).toEqual([
      "Product Agent",
      "Marketing Agent",
      "Content Agent",
      "Executive Orchestrator",
      "Analytics Agent",
      "CEO Dashboard",
    ]);
    expect(capabilities[0]).toMatchObject({
      status: "Ready",
      capability: "Product context planning",
      currentMode: "Plan only",
      readiness: "Ready",
    });
  });

  it("does not mark planned agents as operational", () => {
    const plannedAgents = new DashboardPreviewService()
      .createViewModel({ NODE_ENV: "test" })
      .agentCapabilities.filter((agent) => agent.status === "Planned");

    expect(plannedAgents).toEqual([
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
    ]);
  });

  it("separates existing and planned integrations clearly", () => {
    const groups = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }).integrationGroups;

    expect(groups.map((group) => group.name)).toEqual(["Available", "Existing", "Planned"]);
    expect(groups.find((group) => group.name === "Existing")?.integrations).toEqual([
      { name: "Shopify backend integration", status: "Existing integration", tone: "ready" },
    ]);
    expect(groups.find((group) => group.name === "Planned")?.integrations.map((integration) => integration.name)).toEqual([
      "AutoDS",
      "Meta",
      "TikTok",
      "Amazon",
      "eBay",
      "Gmail",
      "Canva",
      "GitHub automation",
    ]);
  });

  it("keeps the approval center read-only and proposal-only", () => {
    const viewModel = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" });

    expect(viewModel.approvalCenter.items).toEqual([
      "Human approval required",
      "No pending live approvals",
      "Approval execution unavailable in Alpha",
      "No action buttons",
    ]);
    expect(viewModel.systemOverview.safetyMode).toBe("Human Approval Required");
    expect(viewModel.systemOverview.executionMode).toBe("Proposal Only");
    expect(viewModel.executableActions).toEqual([]);
  });

  it("renders responsive semantic HTML without executable controls", () => {
    const html = renderDashboardPreviewHtml(new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }));

    expect(html).toContain("<main>");
    expect(html).toContain("<section aria-labelledby=\"matrix-title\">");
    expect(html).toContain("<table>");
    expect(html).toContain("@media (max-width: 1080px)");
    expect(html).toContain("SAIE-01.12");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("type=\"submit\"");
    expect(html).not.toContain("Publish now");
    expect(html).not.toContain("Run workflow");
  });
});

describe("dashboardPreviewRouter", () => {
  it("returns HTTP 200 with HTML content", async () => {
    const app = express();
    app.use("/api/saie/dashboard", dashboardPreviewRouter);

    const response = await request(app).get("/api/saie/dashboard").expect(200);

    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("<!doctype html>");
    expect(response.text).toContain("Sireh AI Engine");
    expect(response.text).toContain("SAIE-01.12");
  });

  it("keeps route-level security headers for a self-contained Shopify iframe preview", async () => {
    const app = express();
    app.use("/api/saie/dashboard", dashboardPreviewRouter);

    const response = await request(app).get("/api/saie/dashboard").expect(200);

    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["content-security-policy"]).toContain("script-src 'none'");
    expect(response.headers["content-security-policy"]).toContain("style-src 'unsafe-inline'");
    expect(response.headers["content-security-policy"]).toContain(
      "frame-ancestors https://admin.shopify.com https://*.myshopify.com",
    );
    expect(response.headers["x-frame-options"]).toBeUndefined();
  });

  it("does not expose secrets or internal file paths in HTML", async () => {
    const app = express();
    app.use("/api/saie/dashboard", dashboardPreviewRouter);

    const response = await request(app).get("/api/saie/dashboard").expect(200);

    expect(response.text).not.toContain("SHOPIFY_API_SECRET");
    expect(response.text).not.toContain("SHOPIFY_API_KEY");
    expect(response.text).not.toContain("OPENAI_API_KEY");
    expect(response.text).not.toContain("DATABASE_URL");
    expect(response.text).not.toContain("F:\\");
    expect(response.text).not.toContain("C:\\");
    expect(response.text).not.toContain("node_modules");
  });
});
