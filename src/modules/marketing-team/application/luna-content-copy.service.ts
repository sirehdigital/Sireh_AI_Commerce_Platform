import type {
  LunaContentCopyContribution,
  LunaContentCopyInput,
  LunaLylaSpecialistHandoff,
} from "../domain/luna-lyla-specialist.model.js";
import {
  LUNA_LYLA_VERSION,
  LunaLylaSpecialistError,
} from "../domain/luna-lyla-specialist.model.js";
import type { SpecialistContribution } from "../domain/miss-hermes-director.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

export class LunaContentCopyService {
  public constructor(registry = new MarketingTeamAgentRegistry()) {
    const luna = registry.get("LUNA");
    if (
      luna.role !== "CONTENT_COPY" ||
      luna.systemLayer !== "CODEX_SACP_SAIE" ||
      luna.productionExecutionAllowed !== false
    )
      throw new LunaLylaSpecialistError(
        "LUNA_IDENTITY_INVALID",
        "LUNA governance identity is invalid.",
      );
  }
  public prepare(input: LunaContentCopyInput): LunaContentCopyContribution {
    required(input.teamRunId, "teamRunId");
    required(input.correlationId, "correlationId");
    required(input.messagingDirection, "messagingDirection");
    required(input.preparedCopy.bodyCopy, "preparedCopy.bodyCopy");
    required(input.preparedCopy.cta, "preparedCopy.cta");
    if (input.assignment.assignedPersona !== "LUNA")
      throw new LunaLylaSpecialistError(
        "LUNA_ASSIGNMENT_INVALID",
        "LUNA requires a LUNA assignment.",
      );
    if (
      input.assignment.dependencies.some((item) => item.endsWith(":assignment:aria")) &&
      input.ariaContribution.persona !== "ARIA"
    )
      throw new LunaLylaSpecialistError(
        "ARIA_INPUT_REQUIRED",
        "LUNA requires the declared ARIA strategy input.",
      );
    const unsupported = input.claims.filter(
      (claim) => claim.status === "SUPPORTED_CLAIM" && claim.evidenceReferences.length === 0,
    );
    const sensitive = input.claims.filter((claim) =>
      /medical|guarantee|cure|regulated/iu.test(claim.text),
    );
    const escalationReasons = [
      ...unsupported.map((claim) => `Claim ${claim.claimId} lacks supporting evidence.`),
      ...sensitive.map((claim) => `Claim ${claim.claimId} requires sensitive-claim review.`),
    ];
    if (input.brandConstraints.some((item) => /conflict/iu.test(item)))
      escalationReasons.push("Brand constraints conflict with requested content.");
    if (input.contentRequirements.some((item) => /publish|send|production/iu.test(item)))
      escalationReasons.push(
        "Production publication or sending requires Founder-controlled execution.",
      );
    const approvedFacts = input.claims.filter((claim) => claim.status === "APPROVED_FACT");
    const supportedClaims = input.claims.filter((claim) => claim.status === "SUPPORTED_CLAIM");
    const assumptions = input.claims.filter((claim) => claim.status === "ASSUMPTION");
    const blocked = approvedFacts.length === 0 && supportedClaims.length === 0;
    return {
      contributionId: `${input.teamRunId}:contribution:luna`,
      persona: "LUNA",
      role: "CONTENT_COPY",
      teamRunId: input.teamRunId,
      correlationId: input.correlationId,
      sourceReferences: input.productReferences.map((item) => ({ ...item })),
      ariaStrategyReferences: input.ariaContribution.sourceReferences.map((item) => ({ ...item })),
      channel: input.targetChannel,
      market: [...input.targetMarkets],
      contentType: input.contentType,
      messagingObjective: input.messagingDirection,
      hooks: [...input.preparedCopy.hooks],
      ...(input.preparedCopy.headline === undefined
        ? {}
        : { headline: input.preparedCopy.headline }),
      bodyCopy: input.preparedCopy.bodyCopy,
      cta: input.preparedCopy.cta,
      approvedFacts: structuredClone(approvedFacts),
      supportedClaims: structuredClone(supportedClaims),
      assumptions: structuredClone(assumptions),
      creativeCopy: [...input.preparedCopy.hooks, input.preparedCopy.bodyCopy],
      recommendations: [
        `Prepare ${input.contentType} for ${input.targetChannel} review; do not publish.`,
      ],
      claimReferences: dedupe(input.claims.flatMap((claim) => claim.evidenceReferences)),
      risks: escalationReasons,
      limitations: unsupported.map((claim) => `Unsupported claim: ${claim.text}`),
      contentQualityNotes: [
        "Prepared copy is advisory and must pass human review before production use.",
      ],
      reviewRequirements: [...input.reviewRequirements],
      escalationReasons,
      reviewState: blocked
        ? "BLOCKED"
        : escalationReasons.length > 0 || input.reviewRequirements.length > 0
          ? "REVIEW_REQUIRED"
          : "READY",
      attributionVersion: LUNA_LYLA_VERSION,
      executionAllowed: false,
    };
  }
  public prepareLylaHandoff(
    value: LunaContentCopyContribution,
    lylaAssignmentId: string,
  ): LunaLylaSpecialistHandoff {
    required(lylaAssignmentId, "lylaAssignmentId");
    return {
      handoffId: `${value.teamRunId}:handoff:luna-lyla`,
      teamRunId: value.teamRunId,
      correlationId: value.correlationId,
      lunaContribution: structuredClone(value),
      sourceReferences: value.sourceReferences.map((item) => ({ ...item })),
      ariaStrategyReferences: value.ariaStrategyReferences.map((item) => ({ ...item })),
      claimReferences: value.claimReferences.map((item) => ({ ...item })),
      dependencies: [value.contributionId, lylaAssignmentId],
      assumptions: structuredClone(value.assumptions),
      risks: [...value.risks],
      reviewState: value.reviewState,
      fromPersona: "LUNA",
      toPersona: "LYLA",
      executionAllowed: false,
    };
  }
  public toSpecialistContribution(value: LunaContentCopyContribution): SpecialistContribution {
    return {
      contributionId: value.contributionId,
      persona: "LUNA",
      summary: `${value.contentType} prepared for ${value.channel}.`,
      recommendation: value.recommendations.join(" "),
      assumptions: value.assumptions.map((item) => item.text),
      risks: [...value.risks],
      confidence:
        value.reviewState === "READY" ? "HIGH" : value.reviewState === "BLOCKED" ? "LOW" : "MEDIUM",
      evidence: value.claimReferences.map((item) => ({ ...item })),
      dependencies: value.ariaStrategyReferences.map((item) => ({ ...item })),
      reviewState:
        value.reviewState === "READY"
          ? "PASSED"
          : value.reviewState === "BLOCKED"
            ? "BLOCKED"
            : "PENDING",
    };
  }
  public execute(): never {
    throw new LunaLylaSpecialistError(
      "PRODUCTION_EXECUTION_PROHIBITED",
      "LUNA cannot publish, send, execute production actions, or approve for Founder.",
    );
  }
}
function required(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new LunaLylaSpecialistError("REQUIRED_FIELD_MISSING", `${field} is required.`);
}
function dedupe<
  T extends {
    readonly artifactId: string;
    readonly artifactType: string;
    readonly version: string;
  },
>(values: readonly T[]): readonly T[] {
  return [
    ...new Map(
      values.map((item) => [`${item.artifactType}:${item.artifactId}:${item.version}`, item]),
    ).values(),
  ].map((item) => structuredClone(item));
}
