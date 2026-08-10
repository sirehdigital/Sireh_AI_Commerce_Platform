import { describe, expect, it } from "vitest";

import { AppError } from "../../../../shared/errors/app-error.js";
import {
  InMemoryMarketingExecutionRepository,
  MARKETING_EXECUTION_ACTION_TYPES,
  MARKETING_EXECUTION_APPROVAL_STATES,
  MARKETING_EXECUTION_READINESS_STATES,
  MARKETING_EXECUTION_SOURCE_TYPES,
  MARKETING_EXECUTION_STATUSES,
  MARKETING_EXECUTION_TARGETS,
  MARKETING_EXECUTION_VERSION,
  MarketingExecutionService,
  type CreateMarketingExecutionRequestInput,
  type MarketingExecutionAdapter,
  type MarketingExecutionRequest,
} from "../../index.js";
import * as publicExports from "../../../marketing-execution/index.js";

const CREATED_AT = "2026-08-10T12:00:00.000Z";

const buildInput = (overrides: Partial<CreateMarketingExecutionRequestInput> = {}): CreateMarketingExecutionRequestInput => ({
  sourceReference: {
    sourceType: "CONTENT",
    sourceId: "marketing-content:launch-caption-001",
  },
  actionType: "PUBLISH_CONTENT",
  targetPlatform: "INSTAGRAM",
  targetChannel: "INSTAGRAM",
  payloadReference: {
    payloadId: "payload:launch-caption-001",
    summary: "Approved Instagram caption package.",
    metadata: {
      assetCount: 2,
      locale: "en-US",
      previewOnly: true,
    },
  },
  requestedBy: "founder",
  createdAt: CREATED_AT,
  ...overrides,
});

const createService = () => {
  const repository = new InMemoryMarketingExecutionRepository();
  return { repository, service: new MarketingExecutionService(repository) };
};

describe("MarketingExecutionService", () => {
  it("creates a valid execution request", async () => {
    const { service } = createService();

    const request = await service.create(buildInput());

    expect(request).toMatchObject({
      sourceType: "CONTENT",
      actionType: "PUBLISH_CONTENT",
      targetPlatform: "INSTAGRAM",
      targetChannel: "INSTAGRAM",
      approvalRequirement: "REQUIRED",
      executionStatus: "PENDING_APPROVAL",
      advisoryOnly: true,
      executionEnabled: false,
    });
  });

  it("creates deterministic canonical execution identity", async () => {
    const { service } = createService();

    const first = await service.create(buildInput({ sourceReference: { sourceType: "CONTENT", sourceId: " Marketing Content:Launch Caption 001 " } }));
    const second = await service.create(buildInput({ sourceReference: { sourceType: "CONTENT", sourceId: "marketing-content-launch-caption-001" } }));

    expect(first.executionRequestId).toBe("marketing-execution:content:marketing-content-launch-caption-001:publish-content:instagram:instagram");
    expect(second.executionRequestId).toBe(first.executionRequestId);
  });

  it("preserves content source references", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ sourceReference: { sourceType: "CONTENT", sourceId: "content-123" } }));

    expect(request.sourceReference).toEqual({ sourceType: "CONTENT", sourceId: "content-123" });
  });

  it("preserves creative source references", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ sourceReference: { sourceType: "CREATIVE", sourceId: "creative-123" } }));

    expect(request.sourceReference).toEqual({ sourceType: "CREATIVE", sourceId: "creative-123" });
  });

  it("preserves campaign strategy source references", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ sourceReference: { sourceType: "CAMPAIGN_STRATEGY", sourceId: "strategy-123" } }));

    expect(request.sourceReference).toEqual({ sourceType: "CAMPAIGN_STRATEGY", sourceId: "strategy-123" });
  });

  it("preserves target platform", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ targetPlatform: "THREADS", targetChannel: "THREADS" }));

    expect(request.targetPlatform).toBe("THREADS");
  });

  it("preserves target channel", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ targetPlatform: "EMAIL", targetChannel: "EMAIL" }));

    expect(request.targetChannel).toBe("EMAIL");
  });

  it("supports valid action types", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ actionType: "SCHEDULE_CONTENT" }));

    expect(request.actionType).toBe("SCHEDULE_CONTENT");
    expect(MARKETING_EXECUTION_ACTION_TYPES).toContain("SCHEDULE_CONTENT");
  });

  it("rejects malformed action types", async () => {
    const { service } = createService();

    await expect(service.create(buildInput({ actionType: "NOT_REAL" as CreateMarketingExecutionRequestInput["actionType"] }))).rejects.toMatchObject({
      code: "MARKETING_EXECUTION_ACTION_INVALID",
    });
  });

  it("rejects missing source references", async () => {
    const { service } = createService();

    await expect(service.create(buildInput({ sourceReference: { sourceType: "CONTENT", sourceId: " " } }))).rejects.toMatchObject({
      code: "MARKETING_EXECUTION_REQUIRED_FIELD_MISSING",
    });
  });

  it("rejects missing targets", async () => {
    const { service } = createService();

    await expect(service.create(buildInput({ targetPlatform: "NOT_REAL" as CreateMarketingExecutionRequestInput["targetPlatform"] }))).rejects.toMatchObject({
      code: "MARKETING_EXECUTION_TARGET_INVALID",
    });
  });

  it("creates approval-required requests for publishing actions", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ actionType: "PUBLISH_CONTENT" }));

    expect(request.approvalRequirement).toBe("REQUIRED");
    expect(request.readiness.state).toBe("WAITING_FOR_APPROVAL");
  });

  it("permits approval-not-required update requests", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ actionType: "UPDATE_CONTENT", approvalRequirement: "NOT_REQUIRED" }));

    expect(request.approvalRequirement).toBe("NOT_REQUIRED");
    expect(request.executionStatus).toBe("DRAFT");
  });

  it("keeps pending approval requests non-executable", async () => {
    const { service } = createService();

    const request = await service.create(buildInput());

    expect(request.readiness).toMatchObject({ state: "WAITING_FOR_APPROVAL", executable: false });
  });

  it("allows approved requests to become ready", async () => {
    const { service } = createService();
    const request = await service.create(buildInput());

    const approved = await service.transition(request.executionRequestId, "APPROVED", "2026-08-10T12:05:00.000Z");
    const ready = await service.transition(approved.executionRequestId, "READY", "2026-08-10T12:06:00.000Z");

    expect(ready.approvalRequirement).toBe("APPROVED");
    expect(ready.readiness).toMatchObject({ state: "READY", executable: false });
  });

  it("prevents rejected requests from becoming ready", async () => {
    const { service } = createService();
    const request = await service.create(buildInput());
    const rejected = await service.transition(request.executionRequestId, "REJECTED", "2026-08-10T12:05:00.000Z");

    await expect(service.transition(rejected.executionRequestId, "READY", "2026-08-10T12:06:00.000Z")).rejects.toMatchObject({
      code: "MARKETING_EXECUTION_INVALID_TRANSITION",
    });
  });

  it("rejects invalid lifecycle transitions", async () => {
    const { service } = createService();
    const request = await service.create(buildInput({ actionType: "UPDATE_CONTENT", approvalRequirement: "NOT_REQUIRED" }));

    await expect(service.transition(request.executionRequestId, "REJECTED", "2026-08-10T12:05:00.000Z")).rejects.toMatchObject({
      code: "MARKETING_EXECUTION_INVALID_TRANSITION",
    });
  });

  it("keeps blocked requests non-executable", async () => {
    const { service } = createService();
    const request = await service.create(buildInput());

    const blocked = await service.transition(request.executionRequestId, "BLOCKED", "2026-08-10T12:05:00.000Z");

    expect(blocked.readiness).toMatchObject({ state: "BLOCKED", executable: false });
  });

  it("derives readiness WAITING_FOR_APPROVAL", async () => {
    const { service } = createService();

    const request = await service.create(buildInput({ actionType: "SCHEDULE_CONTENT" }));

    expect(request.readiness.state).toBe("WAITING_FOR_APPROVAL");
  });

  it("derives readiness READY", async () => {
    const { service } = createService();
    const request = await service.create(buildInput({ actionType: "UPDATE_CONTENT", approvalRequirement: "NOT_REQUIRED" }));

    const ready = await service.transition(request.executionRequestId, "READY", "2026-08-10T12:05:00.000Z");

    expect(ready.readiness.state).toBe("READY");
  });

  it("derives readiness BLOCKED or INVALID", async () => {
    const { service } = createService();
    const request = await service.create(buildInput({ actionType: "UPDATE_CONTENT", approvalRequirement: "NOT_REQUIRED" }));
    const invalid = service.evaluateReadiness({ ...request, targetChannel: "NOT_REAL" as MarketingExecutionRequest["targetChannel"] });

    expect(request.readiness.state).toBe("BLOCKED");
    expect(invalid.state).toBe("INVALID");
  });

  it("keeps equivalent normalized inputs deterministic", async () => {
    const { service } = createService();
    const input = buildInput({ sourceReference: { sourceType: "MANUAL", sourceId: "Manual Draft 001" }, actionType: "UPDATE_CONTENT", approvalRequirement: "NOT_REQUIRED" });

    const first = await service.create(input);
    const second = await service.create({ ...input, sourceReference: { sourceType: "MANUAL", sourceId: "manual-draft-001" } });

    expect(second.executionRequestId).toBe(first.executionRequestId);
    expect(second.readiness).toEqual(first.readiness);
  });

  it("returns defensive copies from the repository", async () => {
    const { repository, service } = createService();
    const request = await service.create(buildInput());

    (request.payloadReference.metadata as Record<string, string | number | boolean>).assetCount = 99;
    const stored = await repository.findById(request.executionRequestId);

    expect(stored?.payloadReference.metadata?.assetCount).toBe(2);
  });

  it("defines an execution adapter contract without concrete platform side effects", async () => {
    const { service } = createService();
    const request = await service.create(buildInput({ actionType: "UPDATE_CONTENT", approvalRequirement: "NOT_REQUIRED" }));
    const adapter: MarketingExecutionAdapter = {
      canSupport: () => ({ supported: false, reason: "No concrete platform adapter is implemented in SACP-04.05A." }),
      prepare: (executionRequest) => ({
        requestId: executionRequest.executionRequestId,
        readiness: executionRequest.readiness,
        externalExecutionAllowed: false,
      }),
      execute: () => {
        throw AppError.internal("No concrete execution adapter is implemented.", {}, "MARKETING_EXECUTION_ADAPTER_NOT_IMPLEMENTED");
      },
    };

    expect(adapter.canSupport(request)).toEqual({ supported: false, reason: "No concrete platform adapter is implemented in SACP-04.05A." });
    expect(adapter.prepare(request).externalExecutionAllowed).toBe(false);
    expect(() => adapter.execute(request)).toThrow(AppError);
  });

  it("exports the public marketing execution API", () => {
    expect(publicExports.MarketingExecutionService).toBe(MarketingExecutionService);
    expect(publicExports.InMemoryMarketingExecutionRepository).toBe(InMemoryMarketingExecutionRepository);
    expect(publicExports.MARKETING_EXECUTION_VERSION).toBe(MARKETING_EXECUTION_VERSION);
    expect(publicExports.MARKETING_EXECUTION_SOURCE_TYPES).toEqual(["CONTENT", "CREATIVE", "CAMPAIGN_STRATEGY", "MANUAL"]);
    expect(publicExports.MARKETING_EXECUTION_TARGETS).toEqual(MARKETING_EXECUTION_TARGETS);
    expect(MARKETING_EXECUTION_APPROVAL_STATES).toEqual(["NOT_REQUIRED", "REQUIRED", "APPROVED", "REJECTED"]);
    expect(MARKETING_EXECUTION_STATUSES).toEqual(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "READY", "BLOCKED", "CANCELLED"]);
    expect(MARKETING_EXECUTION_READINESS_STATES).toEqual(["READY", "WAITING_FOR_APPROVAL", "BLOCKED", "INVALID"]);
    expect(MARKETING_EXECUTION_SOURCE_TYPES).toContain("CAMPAIGN_STRATEGY");
  });
});
