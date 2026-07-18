import { describe, expect, it } from "vitest";

import { ProcessLocalSaieLogger } from "./process-local-saie.logger.js";

interface CapturedLog {
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

const createCapturedLogger = () => {
  const logs: CapturedLog[] = [];
  const logger = {
    debug: (message: string, metadata?: Record<string, unknown>) => {
      logs.push({ message, ...(metadata === undefined ? {} : { metadata }) });
    },
    info: (message: string, metadata?: Record<string, unknown>) => {
      logs.push({ message, ...(metadata === undefined ? {} : { metadata }) });
    },
    warn: (message: string, metadata?: Record<string, unknown>) => {
      logs.push({ message, ...(metadata === undefined ? {} : { metadata }) });
    },
    error: (message: string, metadata?: Record<string, unknown>) => {
      logs.push({ message, ...(metadata === undefined ? {} : { metadata }) });
    },
  };

  return { logger, logs };
};

describe("ProcessLocalSaieLogger", () => {
  it("writes structured safe log events without request bodies or secrets", () => {
    const { logger, logs } = createCapturedLogger();
    const saieLogger = new ProcessLocalSaieLogger(logger);

    saieLogger.info({
      eventName: "saie.approval.decision.completed",
      message: "Approval decision completed.",
      correlationId: "corr-123",
      operation: "approval.approve",
      entityType: "approval",
      entityId: "approval-product-context",
      outcome: "success",
      metadata: {
        decision: "approved",
        reasonLength: 12,
      },
    });

    expect(logs[0]).toMatchObject({
      message: "Approval decision completed.",
      metadata: {
        eventName: "saie.approval.decision.completed",
        correlationId: "corr-123",
        operation: "approval.approve",
        outcome: "success",
      },
    });
    expect(JSON.stringify(logs)).not.toMatch(/SHOPIFY_API_SECRET|authorization|cookie|requestBody|because secret/iu);
  });
});
