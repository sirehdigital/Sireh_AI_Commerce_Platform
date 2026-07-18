import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { ProcessLocalMetricsRegistry, SaieLogger } from "../../application/index.js";

export type CorrelationIdGenerator = () => string;
export type DurationNow = () => number;

const CORRELATION_HEADER = "x-correlation-id";
const MAX_CORRELATION_ID_LENGTH = 80;
const SAFE_CORRELATION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/u;
const requestCorrelationIds = new WeakMap<Request, string>();

export interface SaieRequestObservabilityOptions {
  readonly metrics: ProcessLocalMetricsRegistry;
  readonly logger: SaieLogger;
  readonly generateCorrelationId?: CorrelationIdGenerator;
  readonly now?: DurationNow;
}

export const createSaieRequestObservabilityMiddleware = (
  options: SaieRequestObservabilityOptions,
): RequestHandler => {
  const generateCorrelationId = options.generateCorrelationId ?? randomUUID;
  const now = options.now ?? (() => performance.now());

  return (request: Request, response: Response, next: NextFunction): void => {
    const correlationId = resolveCorrelationId(request.header(CORRELATION_HEADER), generateCorrelationId);
    const startedAt = now();

    requestCorrelationIds.set(request, correlationId);
    response.setHeader("X-Correlation-ID", correlationId);
    options.logger.info({
      eventName: "saie.http.request.started",
      message: "SAIE HTTP request started.",
      correlationId,
      operation: "http.request",
      metadata: {
        method: request.method,
        routePattern: normalizeRoutePattern(request.method, request.originalUrl),
      },
    });

    response.on("finish", () => {
      const durationMs = now() - startedAt;
      const routePattern = normalizeRoutePattern(request.method, request.originalUrl);
      const statusClass = `${Math.trunc(response.statusCode / 100)}xx`;
      const labels = {
        method: request.method,
        routePattern,
        statusClass,
      };

      options.metrics.incrementCounter("saie_http_requests_total", labels);
      options.metrics.observeDuration("saie_http_request_duration_ms", durationMs, labels);
      if (response.statusCode >= 400) {
        options.metrics.incrementCounter("saie_http_request_failures_total", labels);
      }
      options.logger.info({
        eventName: "saie.http.request.completed",
        message: "SAIE HTTP request completed.",
        correlationId,
        operation: "http.request",
        durationMs,
        outcome: response.statusCode >= 400 ? "failure" : "success",
        metadata: {
          method: request.method,
          routePattern,
          statusClass,
        },
      });
    });

    next();
  };
};

export const getSaieCorrelationId = (request: Request): string | undefined =>
  requestCorrelationIds.get(request);

export const resolveCorrelationId = (
  incomingValue: string | undefined,
  generateCorrelationId: CorrelationIdGenerator,
): string => {
  const normalized = incomingValue?.trim();

  if (
    normalized !== undefined &&
    normalized.length > 0 &&
    normalized.length <= MAX_CORRELATION_ID_LENGTH &&
    SAFE_CORRELATION_ID_PATTERN.test(normalized)
  ) {
    return normalized;
  }

  return generateCorrelationId();
};

export const normalizeRoutePattern = (method: string, originalUrl: string): string => {
  const pathOnly = originalUrl.split("?")[0] ?? "/";
  const normalized = pathOnly
    .replace(/\/api\/saie\/approvals\/[^/]+\/approve$/u, "/api/saie/approvals/:approvalId/approve")
    .replace(/\/api\/saie\/approvals\/[^/]+\/reject$/u, "/api/saie/approvals/:approvalId/reject")
    .replace(/\/api\/saie\/workflows\/[^/]+$/u, "/api/saie/workflows/:workflowId")
    .replace(/\/api\/saie\/approvals\/[^/]+$/u, "/api/saie/approvals/:approvalId")
    .replace(/\/api\/saie\/audits\/[^/]+$/u, "/api/saie/audits/:auditId")
    .replace(/\/api\/saie\/executions\/[^/]+$/u, "/api/saie/executions/:executionId");

  return `${method.toUpperCase()} ${normalized}`;
};
