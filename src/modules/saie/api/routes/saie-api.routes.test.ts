import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { DEFAULT_TENANT_CONTEXT, ProcessLocalMetricsRegistry, type ApprovalRecord } from "../../application/index.js";
import { createSaieApiRouter, type SaieApiRouterOptions } from "./index.js";

const createTestApp = (options?: SaieApiRouterOptions): express.Express => {
  const app = express();

  app.use(express.json());
  app.use("/api/saie", createSaieApiRouter(options));

  return app;
};

const approvedApproval: ApprovalRecord = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "approval-product-context",
  proposalId: "proposal-product-context",
  workflowId: "shopify-product-orchestration",
  title: "Product Context",
  status: "approved",
  riskLevel: "LOW",
  requestedBy: "Product Agent",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  decidedAt: "2026-07-16T00:00:00.000Z",
  decidedBy: "human-reviewer",
  requiresHumanApproval: true,
  executionEnabled: false,
  source: "human-decision",
  version: 2,
};

describe("SAIE Enterprise REST API boundary", () => {
  it("keeps GET /api/saie/dashboard backward-compatible as HTML", async () => {
    const response = await request(createTestApp()).get("/api/saie/dashboard").expect(200);

    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["content-security-policy"]).toContain("script-src 'none'");
    expect(response.text).toContain("<!doctype html>");
    expect(response.text).toContain("Sireh AI Engine");
    expect(response.text).toContain("SAIE-02.10");
    expect(response.text).toContain("Repository-backed snapshot values");
    expect(response.text).toContain("Pending approvals");
  });

  it("returns the read-only SAIE health contract without secrets", async () => {
    const response = await request(createTestApp()).get("/api/saie/health").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: "healthy",
        version: "0.2.0-beta",
        executionEnabled: false,
        approvalRequired: true,
        timestamp: expect.any(String) as string,
        observability: {
          logging: "process-local",
          metrics: "process-local",
          correlationIds: true,
          persistentTelemetry: false,
        },
        tenancy: {
          tenantContextSupported: true,
          tenantIsolationMode: "process-local",
          authenticatedTenantResolution: false,
          defaultContextEnabled: true,
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /SHOPIFY_API_SECRET|SHOPIFY_API_KEY|OPENAI_API_KEY|DATABASE_URL|secret-access-token/iu,
    );
  });

  it("resolves default and explicit tenant context without mixing it with correlation IDs", async () => {
    const app = createTestApp({
      correlationIdGenerator: () => "generated-correlation",
    });

    const defaultResponse = await request(app).get("/api/saie/approvals").expect(200);
    expect(defaultResponse.headers["x-saie-tenant-id"]).toBe("tenant-default");
    expect(defaultResponse.headers["x-saie-store-id"]).toBe("store-default");
    expect(defaultResponse.headers["x-saie-tenant-auth"]).toBe("not-enforced");
    const defaultBody = defaultResponse.body as { data: unknown[] };
    expect(defaultBody.data).toHaveLength(4);

    const tenantResponse = await request(app)
      .get("/api/saie/approvals")
      .set("x-correlation-id", "corr-safe-123")
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .set("x-saie-shop-domain", "SHOP-A.myshopify.com")
      .expect(200);
    expect(tenantResponse.headers["x-correlation-id"]).toBe("corr-safe-123");
    expect(tenantResponse.headers["x-saie-tenant-id"]).toBe("tenant-a");
    expect(tenantResponse.headers["x-saie-store-id"]).toBe("store-a");
    expect(tenantResponse.headers["x-saie-shop-domain"]).toBe("shop-a.myshopify.com");
    const tenantBody = tenantResponse.body as { data: unknown[] };
    expect(tenantBody.data).toEqual([]);

    await request(app)
      .get("/api/saie/approvals")
      .set("x-saie-tenant-id", "bad tenant")
      .set("x-saie-store-id", "store-a")
      .expect(400);
    await request(app)
      .get("/api/saie/approvals")
      .set("x-saie-tenant-id", "tenant-a")
      .set("x-saie-store-id", "store-a")
      .set("x-saie-shop-domain", "https://shop-a.myshopify.com")
      .expect(400);
  });

  it("returns safe process-local metrics and correlation IDs", async () => {
    const metricsRegistry = new ProcessLocalMetricsRegistry(() => "2026-07-16T00:00:00.000Z");
    const app = createTestApp({
      metricsRegistry,
      correlationIdGenerator: () => "generated-correlation",
      durationNow: (() => {
        let value = 0;
        return () => {
          value += 5;
          return value;
        };
      })(),
    });

    const healthResponse = await request(app)
      .get("/api/saie/health")
      .set("x-correlation-id", "corr-safe-123")
      .expect(200);
    expect(healthResponse.headers["x-correlation-id"]).toBe("corr-safe-123");

    const missingResponse = await request(app)
      .get("/api/saie/approvals/approval-secret-123")
      .set("x-correlation-id", "<script>")
      .expect(404);
    expect(missingResponse.headers["x-correlation-id"]).toBe("generated-correlation");

    const metricsResponse = await request(app).get("/api/saie/metrics").expect(200);
    const serialized = JSON.stringify(metricsResponse.body);

    expect(metricsResponse.body).toMatchObject({
      success: true,
      data: {
        storageMode: "process-local",
        persistent: false,
        counters: expect.any(Array) as unknown[],
        gauges: expect.any(Array) as unknown[],
        durations: expect.any(Array) as unknown[],
      },
    });
    expect(serialized).toContain("saie_http_requests_total");
    expect(serialized).toContain("GET /api/saie/approvals/:approvalId");
    expect(serialized).not.toContain("approval-secret-123");
    expect(serialized).not.toMatch(/SHOPIFY_API_SECRET|authorization|cookie|stack|Reviewed and approved/iu);
  });

  it("returns workflow previews with pagination and known workflow lookup", async () => {
    const app = createTestApp();
    const listResponse = await request(app).get("/api/saie/workflows").expect(200);

    expect(listResponse.body).toMatchObject({
      success: true,
      meta: {
        page: 1,
        totalPages: 1,
      },
    });
    expect(listResponse.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "shopify-product-orchestration",
          source: "deterministic-preview",
          approvalRequired: true,
          executionEnabled: false,
        }),
      ]) as unknown[],
    });

    const detailResponse = await request(app)
      .get("/api/saie/workflows/shopify-product-orchestration")
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      data: {
        id: "shopify-product-orchestration",
      },
    });
  });

  it("returns standardized workflow validation and not-found errors", async () => {
    const app = createTestApp();

    const validationResponse = await request(app).get("/api/saie/workflows/INVALID").expect(400);
    expect(validationResponse.body).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Route parameter validation failed.",
        details: [
          {
            field: "workflowId",
            issue: "ID must use lowercase letters, numbers, and hyphens only.",
          },
        ],
      },
    });

    const notFoundResponse = await request(app).get("/api/saie/workflows/missing-workflow").expect(404);
    expect(notFoundResponse.body).toMatchObject({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Workflow was not found.",
      },
    });
  });

  it("returns approval previews and known approval lookup", async () => {
    const app = createTestApp();
    const listResponse = await request(app).get("/api/saie/approvals").expect(200);

    expect(listResponse.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "approval-product-context",
          requiresHumanApproval: true,
          executionEnabled: false,
          source: "deterministic-preview",
          version: 1,
        }),
      ]) as unknown[],
    });

    const detailResponse = await request(app)
      .get("/api/saie/approvals/approval-product-context")
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      data: {
        status: "pending",
      },
    });
    await request(app).get("/api/saie/approvals/missing-approval").expect(404);
  });

  it("approves and rejects pending approvals without creating execution", async () => {
    const approveApp = createTestApp({
      auditIdGenerator: () => "audit-live-approval-approved",
      auditClock: () => "2026-07-16T00:00:00.000Z",
    });
    const approveResponse = await request(approveApp)
      .post("/api/saie/approvals/approval-product-context/approve")
      .send({
        decidedBy: "human-reviewer",
        reason: "Reviewed and approved.",
        expectedVersion: 1,
      })
      .expect(200);

    expect(approveResponse.body).toMatchObject({
      success: true,
      data: {
        id: "approval-product-context",
        status: "approved",
        decidedBy: "human-reviewer",
        decisionReason: "Reviewed and approved.",
        executionEnabled: false,
        requiresHumanApproval: true,
        version: 2,
      },
    });
    expect(JSON.stringify(approveResponse.body)).not.toMatch(/executed|published|queued|dispatched/iu);
    const executionListAfterApproval = await request(approveApp).get("/api/saie/executions").expect(200);
    expect(JSON.stringify(executionListAfterApproval.body)).not.toContain('"source":"in-memory-prepared"');
    const dashboardAfterApproval = await request(approveApp).get("/api/saie/dashboard").expect(200);
    expect(dashboardAfterApproval.text).toContain("Approved approvals");
    expect(dashboardAfterApproval.text).toContain("approval.approved");
    expect(dashboardAfterApproval.text).toContain("in-memory-live");
    expect(dashboardAfterApproval.text).not.toMatch(/execution\.completed|product\.published|Running/iu);
    const auditListResponse = await request(approveApp).get("/api/saie/audits").expect(200);
    expect(auditListResponse.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-live-approval-approved",
          eventType: "approval.approved",
          entityType: "approval",
          entityId: "approval-product-context",
          source: "in-memory-live",
          occurredAt: "2026-07-16T00:00:00.000Z",
          details: expect.objectContaining({
            decision: "approved",
            executionEnabled: false,
          }) as unknown,
        }),
      ]) as unknown[],
    });
    const auditDetailResponse = await request(approveApp)
      .get("/api/saie/audits/audit-live-approval-approved")
      .expect(200);
    expect(auditDetailResponse.body).toMatchObject({
      data: {
        eventType: "approval.approved",
        source: "in-memory-live",
      },
    });
    const approveMetrics = await request(approveApp).get("/api/saie/metrics").expect(200);
    expect(JSON.stringify(approveMetrics.body)).toContain("saie_approval_decisions_total");
    expect(JSON.stringify(approveMetrics.body)).toContain("saie_audit_events_appended_total");
    expect(JSON.stringify(approveMetrics.body)).not.toContain("Reviewed and approved.");

    const rejectApp = createTestApp({
      auditIdGenerator: () => "audit-live-approval-rejected",
      auditClock: () => "2026-07-16T00:00:00.000Z",
    });
    const rejectResponse = await request(rejectApp)
      .post("/api/saie/approvals/approval-product-context/reject")
      .send({
        decidedBy: "human-reviewer",
        reason: "Supplier risk requires revision.",
        expectedVersion: 1,
      })
      .expect(200);

    expect(rejectResponse.body).toMatchObject({
      data: {
        status: "rejected",
        decisionReason: "Supplier risk requires revision.",
        executionEnabled: false,
        version: 2,
      },
    });
    const rejectAuditResponse = await request(rejectApp)
      .get("/api/saie/audits/audit-live-approval-rejected")
      .expect(200);
    expect(rejectAuditResponse.body).toMatchObject({
      data: {
        eventType: "approval.rejected",
        source: "in-memory-live",
      },
    });
  });

  it("validates approval decision bodies and maps conflicts", async () => {
    const app = createTestApp();

    await request(app)
      .post("/api/saie/approvals/approval-product-context/approve")
      .send({ reason: "Missing actor." })
      .expect(400);
    await request(app)
      .post("/api/saie/approvals/approval-product-context/reject")
      .send({ decidedBy: "human-reviewer" })
      .expect(400);
    await request(app)
      .post("/api/saie/approvals/missing-approval/approve")
      .send({ decidedBy: "human-reviewer" })
      .expect(404);
    await request(app)
      .post("/api/saie/approvals/approval-product-context/approve")
      .send({ decidedBy: "human-reviewer", expectedVersion: 99 })
      .expect(409);
    const metricsResponse = await request(app).get("/api/saie/metrics").expect(200);
    expect(JSON.stringify(metricsResponse.body)).toContain("saie_approval_validation_failures_total");
    expect(JSON.stringify(metricsResponse.body)).toContain("saie_approval_conflicts_total");

    const conflictApp = createTestApp();
    await request(conflictApp)
      .post("/api/saie/approvals/approval-product-context/approve")
      .send({ decidedBy: "human-reviewer", expectedVersion: 1 })
      .expect(200);
    await request(conflictApp)
      .post("/api/saie/approvals/approval-product-context/reject")
      .send({ decidedBy: "human-reviewer", reason: "Too late.", expectedVersion: 2 })
      .expect(409);
  });

  it("returns audit previews with explicit deterministic source", async () => {
    const app = createTestApp();
    const listResponse = await request(app).get("/api/saie/audits").expect(200);

    expect(listResponse.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-product-agent-01",
          source: "deterministic-preview",
          evidence: "Deterministic preview activity only; not persisted audit evidence.",
        }),
      ]) as unknown[],
    });

    const detailResponse = await request(app).get("/api/saie/audits/audit-product-agent-01").expect(200);
    expect(detailResponse.body).toMatchObject({
      data: {
        actor: "Product Agent",
      },
    });
    await request(app).get("/api/saie/audits/missing-audit").expect(404);
  });

  it("returns execution previews that confirm execution is disabled", async () => {
    const app = createTestApp();
    const listResponse = await request(app).get("/api/saie/executions").expect(200);

    expect(listResponse.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "execution-preview-shopify-product-orchestration",
          mode: "preview",
          executionEnabled: false,
          approvalRequired: true,
          executableActions: [],
          source: "deterministic-preview",
        }),
      ]) as unknown[],
    });

    const detailResponse = await request(app)
      .get("/api/saie/executions/execution-preview-shopify-product-orchestration")
      .expect(200);
    expect(detailResponse.body).toMatchObject({
      data: {
        status: "DISABLED",
      },
    });
    await request(app).get("/api/saie/executions/missing-execution").expect(404);
  });

  it("can read internally prepared execution records without exposing execution mutation routes", async () => {
    const preparedApp = createTestApp({
      approvalSeedRecords: [approvedApproval],
      auditIdGenerator: () => "audit-execution-prepared",
      auditClock: () => "2026-07-16T00:00:00.000Z",
      executionIdGenerator: () => "execution-live-product-context",
      executionClock: () => "2026-07-16T00:00:00.000Z",
      configureInternalExecutionPreparation: (command) => {
        command.execute({
          tenant: DEFAULT_TENANT_CONTEXT,
          approvalId: "approval-product-context",
          preparedBy: "internal-review-coordinator",
        });
      },
    });

    const executionResponse = await request(preparedApp)
      .get("/api/saie/executions/execution-live-product-context")
      .expect(200);
    expect(executionResponse.body).toMatchObject({
      data: {
        id: "execution-live-product-context",
        status: "prepared",
        mode: "preview",
        source: "in-memory-prepared",
        executionEnabled: false,
        approvalRequired: true,
        executableActions: [],
      },
    });

    const auditResponse = await request(preparedApp).get("/api/saie/audits").expect(200);
    expect(auditResponse.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-execution-prepared",
          eventType: "execution.prepared",
          entityId: "execution-live-product-context",
          source: "in-memory-live",
        }),
      ]) as unknown[],
    });
    const dashboardResponse = await request(preparedApp).get("/api/saie/dashboard").expect(200);
    expect(dashboardResponse.text).toContain("Prepared executions");
    expect(dashboardResponse.text).toContain("execution.prepared");
    expect(dashboardResponse.text).toContain("Execution Disabled");
    expect(dashboardResponse.text).not.toMatch(/execution\.completed|product\.published|Running/iu);
    const metricsResponse = await request(preparedApp).get("/api/saie/metrics").expect(200);
    expect(JSON.stringify(metricsResponse.body)).toContain("saie_execution_preparations_total");
    expect(JSON.stringify(metricsResponse.body)).toContain("saie_dashboard_snapshots_total");
    await request(preparedApp).post("/api/saie/executions").expect(404);
  });

  it("exposes only approval decision mutation routes and blocks execution commands", async () => {
    const app = createTestApp();
    const blockedRoutes = [
      "/api/saie/workflows",
      "/api/saie/executions",
      "/api/saie/executions/execution-preview-shopify-product-orchestration/start",
      "/api/saie/executions/execution-preview-shopify-product-orchestration/retry",
      "/api/saie/executions/execution-preview-shopify-product-orchestration/cancel",
      "/api/saie/publish",
      "/api/saie/shopify/products",
    ];

    for (const route of blockedRoutes) {
      await request(app).post(route).expect(404);
    }
  });
});
