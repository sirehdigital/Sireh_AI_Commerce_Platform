import { describe, expect, it } from "vitest";

import { ProcessLocalMetricsRegistry } from "./metrics-registry.js";

describe("ProcessLocalMetricsRegistry", () => {
  it("increments counters, updates gauges, and aggregates durations", () => {
    const registry = new ProcessLocalMetricsRegistry(() => "2026-07-16T00:00:00.000Z");

    registry.incrementCounter("saie_http_requests_total", {
      method: "GET",
      routePattern: "GET /api/saie/approvals/:approvalId",
      statusClass: "2xx",
    });
    registry.incrementCounter("saie_http_requests_total", {
      method: "GET",
      routePattern: "GET /api/saie/approvals/:approvalId",
      statusClass: "2xx",
    });
    registry.setGauge("saie_approvals_current", 4);
    registry.observeDuration("saie_http_request_duration_ms", 4);
    registry.observeDuration("saie_http_request_duration_ms", 10);

    const snapshot = registry.snapshot();

    expect(snapshot).toMatchObject({
      generatedAt: "2026-07-16T00:00:00.000Z",
      storageMode: "process-local",
      persistent: false,
    });
    expect(snapshot.counters[0]).toMatchObject({
      name: "saie_http_requests_total",
      labels: {
        method: "GET",
        routePattern: "GET /api/saie/approvals/:approvalId",
        statusClass: "2xx",
      },
      value: 2,
    });
    expect(snapshot.gauges[0]).toMatchObject({ name: "saie_approvals_current", value: 4 });
    expect(snapshot.durations[0]?.value).toMatchObject({
      count: 2,
      totalMs: 14,
      averageMs: 7,
      minMs: 4,
      maxMs: 10,
    });
  });

  it("normalizes unsafe labels without storing individual observations", () => {
    const registry = new ProcessLocalMetricsRegistry();

    registry.incrementCounter("saie_http_requests_total", {
      routePattern: "/api/saie/approvals/approval-secret<script>",
    });
    registry.observeDuration("duration", 1);

    const snapshot = registry.snapshot();

    expect(snapshot.counters[0]?.labels.routePattern).toBe("invalid");
    expect(JSON.stringify(snapshot)).not.toContain("approval-secret<script>");
    expect(snapshot.durations[0]?.value).toMatchObject({ count: 1 });
    expect(JSON.stringify(snapshot.durations[0])).not.toContain("[");
  });
});
