import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { ProcessLocalMetricsRegistry, type SaieLogger, type SaieLogEvent } from "../../application/index.js";
import {
  createSaieRequestObservabilityMiddleware,
  getSaieCorrelationId,
  normalizeRoutePattern,
} from "./correlation.middleware.js";

class CapturingLogger implements SaieLogger {
  public readonly events: SaieLogEvent[] = [];
  public debug(event: SaieLogEvent): void { this.events.push(event); }
  public info(event: SaieLogEvent): void { this.events.push(event); }
  public warn(event: SaieLogEvent): void { this.events.push(event); }
  public error(event: SaieLogEvent): void { this.events.push(event); }
}

describe("SAIE correlation middleware", () => {
  it("accepts valid incoming IDs and returns the response header", async () => {
    const logger = new CapturingLogger();
    const metrics = new ProcessLocalMetricsRegistry();
    const app = express();

    app.use(createSaieRequestObservabilityMiddleware({ metrics, logger }));
    app.get("/api/saie/approvals/:approvalId", (request, response) => {
      response.json({ correlationId: getSaieCorrelationId(request) });
    });

    const response = await request(app)
      .get("/api/saie/approvals/approval-product-context")
      .set("x-correlation-id", "corr-safe-123")
      .expect(200);

    expect(response.headers["x-correlation-id"]).toBe("corr-safe-123");
    expect(response.body).toEqual({ correlationId: "corr-safe-123" });
    expect(metrics.snapshot().counters[0]).toMatchObject({
      labels: {
        routePattern: "GET /api/saie/approvals/:approvalId",
      },
    });
  });

  it("replaces invalid or oversized IDs and normalizes route patterns", async () => {
    const logger = new CapturingLogger();
    const metrics = new ProcessLocalMetricsRegistry();
    const app = express();

    app.use(
      createSaieRequestObservabilityMiddleware({
        metrics,
        logger,
        generateCorrelationId: () => "generated-correlation",
      }),
    );
    app.get("/api/saie/audits/:auditId", (_request, response) => {
      response.status(404).json({ ok: false });
    });

    const response = await request(app)
      .get("/api/saie/audits/audit-secret-123")
      .set("x-correlation-id", "<script>")
      .expect(404);

    expect(response.headers["x-correlation-id"]).toBe("generated-correlation");
    expect(normalizeRoutePattern("GET", "/api/saie/audits/audit-secret-123")).toBe(
      "GET /api/saie/audits/:auditId",
    );
    expect(JSON.stringify(metrics.snapshot())).not.toContain("audit-secret-123");
    expect(metrics.snapshot().counters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "saie_http_request_failures_total" }),
      ]),
    );
  });
});
