import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { dashboardPreviewRouter } from "./dashboard-preview.controller.js";
import { DashboardPreviewService } from "./dashboard-preview.service.js";
import { renderDashboardPreviewHtml } from "./dashboard-preview.template.js";

describe("DashboardPreviewService", () => {
  it("creates a deterministic dashboard view model", () => {
    const viewModel = new DashboardPreviewService().createViewModel({
      NODE_ENV: "production",
      SHOPIFY_API_KEY: "secret-key",
      SHOPIFY_API_SECRET: "secret-secret",
      SHOPIFY_APP_URL: "https://app.example.com",
    });

    expect(viewModel).toMatchObject({
      engineName: "Sireh AI Engine",
      subtitle: "Enterprise AI Operating System",
      version: "v0.1.0 Alpha",
      build: "SAIE-01.11 Dashboard Preview",
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

  it("represents Product, Marketing, Content, and Executive components", () => {
    const agents = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }).agents;

    expect(agents.map((agent) => agent.name)).toEqual([
      "Product Agent",
      "Marketing Agent",
      "Content Agent",
      "Executive Orchestrator",
      "Analytics Agent",
      "CEO Dashboard",
    ]);
  });

  it("does not mark planned agents as operational", () => {
    const plannedAgents = new DashboardPreviewService()
      .createViewModel({ NODE_ENV: "test" })
      .agents.filter((agent) => agent.status === "Planned");

    expect(plannedAgents).toEqual([
      { name: "Analytics Agent", status: "Planned", tone: "planned" },
      { name: "CEO Dashboard", status: "Planned", tone: "planned" },
    ]);
  });

  it("keeps human approval and proposal-only safety modes", () => {
    const viewModel = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" });

    expect(viewModel.systemOverview.safetyMode).toBe("Human Approval Required");
    expect(viewModel.systemOverview.executionMode).toBe("Proposal Only");
    expect(viewModel.safetyControls).toContain("Human approval required");
    expect(viewModel.safetyControls).toContain("Executable actions disabled");
  });

  it("renders no executable controls or mutation forms", () => {
    const html = renderDashboardPreviewHtml(new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }));

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
    expect(response.text).toContain("SAIE-01.11 Dashboard Preview");
  });

  it("sets a narrow route-level CSP suitable for a self-contained Shopify iframe preview", async () => {
    const app = express();
    app.use("/api/saie/dashboard", dashboardPreviewRouter);

    const response = await request(app).get("/api/saie/dashboard").expect(200);

    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["content-security-policy"]).toContain("script-src 'none'");
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
