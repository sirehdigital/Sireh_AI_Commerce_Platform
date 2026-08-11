import type { MarketingExecutionRequest } from "../../marketing-execution/index.js";
import type {
  CreateMarketingTeamRunInput,
  FounderApprovalPacket,
  HermesExecutionReceiptExpectation,
  HermesHandoffEnvelope,
  MarketingTeamAgentId,
  MarketingTeamAuditEvent,
  MarketingTeamRun,
  MarketingTeamRunStatus,
} from "../domain/marketing-team.model.js";
import {
  MARKETING_TEAM_VERSION,
  MarketingTeamGovernanceError,
} from "../domain/marketing-team.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

export class MarketingTeamOrchestrationService {
  private readonly runs = new Map<string, MarketingTeamRun>();
  private readonly events: MarketingTeamAuditEvent[] = [];

  public constructor(private readonly registry = new MarketingTeamAgentRegistry()) {}

  public createRun(input: CreateMarketingTeamRunInput): MarketingTeamRun {
    required(input.teamRunId, "teamRunId");
    required(input.correlationId, "correlationId");
    strictIso(input.createdAt);
    if (this.runs.has(input.teamRunId))
      throw new MarketingTeamGovernanceError(
        "DUPLICATE_TEAM_RUN",
        `Team run ${input.teamRunId} already exists.`,
      );
    const agent = this.registry.get(input.assignedAgent);
    if (!agent.capabilities.includes(input.requestedCapability))
      throw new MarketingTeamGovernanceError(
        "CAPABILITY_NOT_ALLOWED",
        `${input.assignedAgent} may not ${input.requestedCapability.toLowerCase()}.`,
      );
    if (input.campaignStrategy.advisoryOnly !== true)
      throw new MarketingTeamGovernanceError(
        "STRATEGY_NOT_ADVISORY",
        "Canonical strategy must remain advisory-only.",
      );
    if (input.campaignStrategy.requiresHumanReview && input.reviewRequirement === "NONE")
      throw new MarketingTeamGovernanceError("REVIEW_REQUIRED", "Strategy requires a review path.");

    const run: MarketingTeamRun = {
      teamRunId: input.teamRunId,
      sourceReference: { ...input.sourceReference },
      campaignStrategy: structuredClone(input.campaignStrategy),
      assignedAgent: input.assignedAgent,
      requestedCapability: input.requestedCapability,
      inputArtifacts: input.inputArtifacts.map((item) => ({ ...item })),
      outputArtifacts: [],
      dependencies: [...(input.dependencies ?? [])],
      status: input.campaignStrategy.requiresHumanReview ? "REVIEW_REQUIRED" : "PLANNED",
      reviewRequirement: input.reviewRequirement,
      correlationId: input.correlationId,
      ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
      attribution: {
        agent: input.assignedAgent,
        source: { ...input.sourceReference },
        version: MARKETING_TEAM_VERSION,
        teamRunId: input.teamRunId,
        evidence: input.evidence.map((item) => ({ ...item })),
        dependencies: input.inputArtifacts.map((item) => ({ ...item })),
      },
      proposalOnly: true,
      executionAllowed: false,
    };
    this.runs.set(run.teamRunId, structuredClone(run));
    this.append(run, "RUN_CREATED", input.assignedAgent, input.createdAt, { status: run.status });
    return structuredClone(run);
  }

  public changeStatus(
    teamRunId: string,
    status: MarketingTeamRunStatus,
    actor: MarketingTeamAgentId,
    occurredAt: string,
  ): MarketingTeamRun {
    const run = this.find(teamRunId);
    this.registry.get(actor);
    strictIso(occurredAt);
    if (status === "READY_FOR_FOUNDER" && run.reviewRequirement === "NONE")
      throw new MarketingTeamGovernanceError(
        "FOUNDER_REVIEW_REQUIRED",
        "Founder-ready runs must carry a review requirement.",
      );
    const updated = { ...run, status };
    this.runs.set(teamRunId, structuredClone(updated));
    this.append(updated, "STATUS_CHANGED", actor, occurredAt, { status });
    return structuredClone(updated);
  }

  public composeFounderPacket(
    teamRunId: string,
    preparedBy: MarketingTeamAgentId,
    summary: string,
    occurredAt: string,
    proposedExecutionRequest?: MarketingExecutionRequest,
  ): FounderApprovalPacket {
    const run = this.find(teamRunId);
    this.requireCapability(preparedBy, "PREPARE");
    required(summary, "summary");
    strictIso(occurredAt);
    if (
      proposedExecutionRequest?.executionEnabled !== false ||
      proposedExecutionRequest?.advisoryOnly !== true
    )
      throw new MarketingTeamGovernanceError(
        "EXECUTION_BOUNDARY_VIOLATION",
        "Execution request must use the non-executable SACP-04.05A contract.",
      );
    const packet: FounderApprovalPacket = {
      packetId: `founder-approval:${teamRunId}`,
      teamRunId,
      campaignStrategy: structuredClone(run.campaignStrategy),
      ...(proposedExecutionRequest === undefined
        ? {}
        : { proposedExecutionRequest: structuredClone(proposedExecutionRequest) }),
      summary: summary.trim(),
      recommendations: structuredClone(run.campaignStrategy.recommendations),
      risks: structuredClone(run.campaignStrategy.strategicRisks),
      reviewRequirement: "FOUNDER",
      preparedBy,
      attribution: {
        ...run.attribution,
        agent: preparedBy,
        evidence: run.attribution.evidence.map((item) => ({ ...item })),
        dependencies: run.attribution.dependencies.map((item) => ({ ...item })),
      },
      decisionOptions: ["APPROVE", "REJECT", "REQUEST_CHANGES"],
      approvalDecisionRecorded: false,
      executionAllowed: false,
    };
    this.append(run, "FOUNDER_PACKET_PREPARED", preparedBy, occurredAt, {
      packetId: packet.packetId,
    });
    return packet;
  }

  public prepareHermesHandoff(
    packet: FounderApprovalPacket,
    executionRequest: MarketingExecutionRequest,
    preparedBy: MarketingTeamAgentId,
    occurredAt: string,
  ): {
    readonly envelope: HermesHandoffEnvelope;
    readonly receiptExpectation: HermesExecutionReceiptExpectation;
  } {
    const run = this.find(packet.teamRunId);
    this.requireCapability(preparedBy, "PREPARE");
    strictIso(occurredAt);
    if (
      packet.approvalDecisionRecorded ||
      packet.executionAllowed ||
      executionRequest.executionEnabled ||
      !executionRequest.advisoryOnly
    )
      throw new MarketingTeamGovernanceError(
        "EXECUTION_BOUNDARY_VIOLATION",
        "Marketing Team can only prepare a non-executable Hermes handoff.",
      );
    const handoffId = `hermes-handoff:${packet.packetId}:${executionRequest.executionRequestId}`;
    const envelope: HermesHandoffEnvelope = {
      handoffId,
      teamRunId: packet.teamRunId,
      founderApprovalPacketId: packet.packetId,
      executionRequest: structuredClone(executionRequest),
      preparedBy,
      contractVersion: MARKETING_TEAM_VERSION,
      externalExecutionAllowed: false,
    };
    const receiptExpectation: HermesExecutionReceiptExpectation = {
      handoffId,
      requiredFields: [
        "externalExecutionId",
        "status",
        "startedAt",
        "completedAt",
        "auditReference",
      ],
      producedByMarketingTeam: false,
    };
    this.append(run, "HERMES_HANDOFF_PREPARED", preparedBy, occurredAt, { handoffId });
    return { envelope, receiptExpectation };
  }

  public listAuditEvents(teamRunId: string): readonly MarketingTeamAuditEvent[] {
    return this.events
      .filter((event) => event.teamRunId === teamRunId)
      .map((event) => structuredClone(event));
  }
  public execute(): never {
    throw new MarketingTeamGovernanceError(
      "PRODUCTION_EXECUTION_PROHIBITED",
      "Marketing Team cannot execute production actions.",
    );
  }

  private find(id: string): MarketingTeamRun {
    const run = this.runs.get(id);
    if (run === undefined)
      throw new MarketingTeamGovernanceError("TEAM_RUN_NOT_FOUND", `Team run ${id} was not found.`);
    return structuredClone(run);
  }
  private requireCapability(id: MarketingTeamAgentId, capability: "PREPARE"): void {
    if (!this.registry.get(id).capabilities.includes(capability))
      throw new MarketingTeamGovernanceError(
        "CAPABILITY_NOT_ALLOWED",
        `${id} may not ${capability.toLowerCase()}.`,
      );
  }
  private append(
    run: MarketingTeamRun,
    eventType: MarketingTeamAuditEvent["eventType"],
    actor: MarketingTeamAgentId,
    occurredAt: string,
    details: MarketingTeamAuditEvent["details"],
  ): void {
    const sequence = this.events.length + 1;
    this.events.push({
      eventId: `${run.teamRunId}:event:${sequence}`,
      sequence,
      teamRunId: run.teamRunId,
      eventType,
      actor,
      occurredAt,
      correlationId: run.correlationId,
      details: { ...details },
    });
  }
}

function required(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new MarketingTeamGovernanceError("REQUIRED_FIELD_MISSING", `${field} is required.`);
}
function strictIso(value: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== value)
    throw new MarketingTeamGovernanceError(
      "TIMESTAMP_INVALID",
      "Timestamp must be strict ISO UTC.",
    );
}
