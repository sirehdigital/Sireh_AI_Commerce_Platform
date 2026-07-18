import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { dashboardPreviewRouter } from "./dashboard-preview.controller.js";
import { DashboardPreviewService } from "./dashboard-preview.service.js";
import { renderDashboardPreviewHtml } from "./dashboard-preview.template.js";

describe("DashboardPreviewService", () => {
  it("creates a deterministic SAIE-02.10 beta console preview view model", () => {
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
      version: "v0.2.0 Beta",
      build: "SAIE-02.10",
      environmentLabel: "Production",
      footer: {
        company: "Sireh Digital",
        poweredBy: "Powered by SAIE",
        version: "v0.2.0 Beta",
        build: "Build SAIE-02.10",
      },
      executableActions: [],
    });
  });

  it("includes deterministic executive operations summary counts without fake commercial metrics", () => {
    const viewModel = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" });

    expect(viewModel.operationsSummary.map((item) => item.label)).toEqual([
      "Product proposals",
      "Marketing proposals",
      "Content proposals",
      "Ready for review",
      "Needs input",
      "Blocked",
    ]);
    expect(JSON.stringify([...viewModel.kpis, ...viewModel.operationsSummary])).not.toMatch(
      /revenue|orders|customers|sales/iu,
    );
  });

  it("contains the proposal queue preview with deterministic statuses", () => {
    const queue = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }).proposalQueue;

    expect(queue.map((item) => item.status)).toEqual([
      "READY_FOR_REVIEW",
      "READY_FOR_REVIEW",
      "NEEDS_INPUT",
      "BLOCKED",
    ]);
    expect(queue.every((item) => item.approvalRequirement === "Human review required")).toBe(true);
    expect(queue.every((item) => item.lastPreviewUpdate.startsWith("Preview"))).toBe(true);
  });

  it("contains deterministic agent activity preview entries", () => {
    const activity = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }).agentActivity;

    expect(activity).toEqual([
      {
        agent: "Product Agent",
        activityType: "Prepared product context",
        status: "READY_FOR_REVIEW",
        previewTimestamp: "Preview activity 01",
      },
      {
        agent: "Marketing Agent",
        activityType: "Generated campaign proposal",
        status: "READY_FOR_REVIEW",
        previewTimestamp: "Preview activity 02",
      },
      {
        agent: "Content Agent",
        activityType: "Prepared content proposal",
        status: "NEEDS_INPUT",
        previewTimestamp: "Preview activity 03",
      },
      {
        agent: "Executive Orchestrator",
        activityType: "Consolidated plan",
        status: "BLOCKED",
        previewTimestamp: "Preview activity 04",
      },
    ]);
  });

  it("contains system health preview without marking limited modules as healthy", () => {
    const health = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }).systemHealth;

    expect(health.map((item) => item.component)).toEqual([
      "Core Engine",
      "Agent Registry",
      "Workflow Engine",
      "Controlled Execution",
      "Shopify Integration",
      "Dashboard Presentation",
    ]);
    expect(health.find((item) => item.component === "Controlled Execution")?.status).toBe("LIMITED");
    expect(health.find((item) => item.component === "Shopify Integration")?.status).toBe("LIMITED");
  });

  it("represents Beta limitations accurately in the executive risk panel", () => {
    const risks = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }).executiveRisks;

    expect(risks.map((risk) => risk.limitation)).toEqual([
      "No durable persistence",
      "No live approval queue",
      "No RBAC",
      "Process-local tenant isolation",
      "No background jobs",
      "No live observability",
    ]);
  });

  it("keeps notification center read-only and proposal-only", () => {
    const viewModel = new DashboardPreviewService().createViewModel({ NODE_ENV: "test" });

    expect(viewModel.notifications.map((notification) => notification.title)).toEqual([
      "Human approval is required",
      "Execution remains disabled",
      "Planned integrations are not connected",
      "Shopify embedded configuration may require host/app URL update",
    ]);
    expect(viewModel.systemOverview.safetyMode).toBe("Human Approval Required");
    expect(viewModel.systemOverview.executionMode).toBe("Proposal Only");
    expect(viewModel.executableActions).toEqual([]);
  });

  it("renders responsive semantic HTML without action buttons, forms, or mutation controls", () => {
    const html = renderDashboardPreviewHtml(new DashboardPreviewService().createViewModel({ NODE_ENV: "test" }));

    expect(html).toContain("<main>");
    expect(html).toContain("<section id=\"proposal-queue\"");
    expect(html).toContain("Proposal Queue Preview");
    expect(html).toContain("Agent Activity Preview");
    expect(html).toContain("System Health Preview");
    expect(html).toContain("Executive Risk Panel");
    expect(html).toContain("@media (max-width: 1080px)");
    expect(html).toContain("href=\"#proposal-queue\"");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("type=\"submit\"");
    expect(html).not.toContain("Approve");
    expect(html).not.toContain("Publish now");
    expect(html).not.toContain("Run workflow");
    expect(html).not.toMatch(/revenue|orders|customers|sales/iu);
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
    expect(response.text).toContain("SAIE-02.10");
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
