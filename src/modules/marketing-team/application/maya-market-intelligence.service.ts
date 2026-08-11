import type {
  EvidenceFreshness,
  EvidenceQualityAssessment,
  MarketEvidenceItem,
  MayaAriaSpecialistHandoff,
  MayaMarketIntelligenceContribution,
  MayaMarketIntelligenceInput,
} from "../domain/maya-aria-specialist.model.js";
import {
  MAYA_ARIA_VERSION,
  MayaAriaSpecialistError,
} from "../domain/maya-aria-specialist.model.js";
import type { SpecialistContribution } from "../domain/miss-hermes-director.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

export class MayaMarketIntelligenceService {
  public constructor(registry = new MarketingTeamAgentRegistry()) {
    const maya = registry.get("MAYA");
    if (
      maya.role !== "MARKET_INTELLIGENCE" ||
      maya.systemLayer !== "CODEX_SACP_SAIE" ||
      maya.productionExecutionAllowed !== false
    )
      throw new MayaAriaSpecialistError(
        "MAYA_IDENTITY_INVALID",
        "MAYA governance identity is invalid.",
      );
  }

  public analyse(input: MayaMarketIntelligenceInput): MayaMarketIntelligenceContribution {
    this.validate(input);
    const quality = assessEvidenceQuality(input);
    const statements = (kind: MarketEvidenceItem["kind"]) =>
      input.evidence.filter((item) => item.kind === kind).map((item) => item.statement);
    const escalationReasons = [...quality.reasons];
    if (input.evidence.some((item) => item.privacySensitive))
      escalationReasons.push("Privacy-sensitive evidence requires human review.");
    if (input.constraints.some((item) => /unsupported audience assumption/iu.test(item)))
      escalationReasons.push("Unsupported audience assumptions require review.");
    const reviewState =
      quality.level === "INSUFFICIENT"
        ? "BLOCKED"
        : quality.level === "LOW" || escalationReasons.length > 0
          ? "REVIEW_REQUIRED"
          : "READY";
    const limitations = quality.level === "HIGH" ? [] : quality.reasons;
    const observedFacts = statements("OBSERVED_FACT");
    const calculatedSignals = statements("CALCULATED_SIGNAL");
    return {
      contributionId: `${input.teamRunId}:contribution:maya`,
      persona: "MAYA",
      role: "MARKET_INTELLIGENCE",
      teamRunId: input.teamRunId,
      correlationId: input.correlationId,
      sourceReferences: dedupe([
        input.objectiveReference,
        input.productReference,
        ...(input.commerceContext === undefined ? [] : [input.commerceContext]),
      ]),
      marketScope: [...input.targetMarkets],
      productContext: { ...input.productReference },
      audienceObservations: filterDimension(input.evidence, "AUDIENCE"),
      marketObservations: filterDimension(input.evidence, "MARKET"),
      demandOpportunitySignals: filterDimension(input.evidence, "DEMAND"),
      commerceSignals: filterDimension(input.evidence, "COMMERCE"),
      observedFacts,
      calculatedSignals,
      assumptions: statements("ASSUMPTION"),
      inferences: statements("INFERENCE"),
      recommendations:
        quality.level === "INSUFFICIENT"
          ? []
          : [`Use ${input.requestedDimensions.join(", ")} evidence as advisory strategic input.`],
      risks: escalationReasons,
      evidence: structuredClone(input.evidence),
      evidenceQuality: quality,
      limitations,
      confidence: quality.level,
      escalationReasons,
      reviewState,
      attributionVersion: MAYA_ARIA_VERSION,
      executionAllowed: false,
    };
  }

  public prepareAriaHandoff(
    contribution: MayaMarketIntelligenceContribution,
    ariaAssignmentId: string,
  ): MayaAriaSpecialistHandoff {
    required(ariaAssignmentId, "ariaAssignmentId");
    return {
      handoffId: `${contribution.teamRunId}:handoff:maya-aria`,
      teamRunId: contribution.teamRunId,
      correlationId: contribution.correlationId,
      mayaContribution: structuredClone(contribution),
      sourceReferences: contribution.sourceReferences.map((item) => ({ ...item })),
      evidenceQuality: {
        ...contribution.evidenceQuality,
        reasons: [...contribution.evidenceQuality.reasons],
      },
      assumptions: [...contribution.assumptions],
      limitations: [...contribution.limitations],
      dependencyIds: [contribution.contributionId, ariaAssignmentId],
      reviewState: contribution.reviewState,
      fromPersona: "MAYA",
      toPersona: "ARIA",
      executionAllowed: false,
    };
  }

  public toSpecialistContribution(
    value: MayaMarketIntelligenceContribution,
  ): SpecialistContribution {
    return {
      contributionId: value.contributionId,
      persona: "MAYA",
      summary: `Market intelligence for ${value.marketScope.join(", ")}.`,
      recommendation:
        value.recommendations.join(" ") || "Gather additional evidence before recommendation.",
      assumptions: [...value.assumptions],
      risks: [...value.risks],
      confidence:
        value.confidence === "HIGH" ? "HIGH" : value.confidence === "MEDIUM" ? "MEDIUM" : "LOW",
      evidence: value.evidence.map(({ artifactId, artifactType, version }) => ({
        artifactId,
        artifactType,
        version,
      })),
      dependencies: value.sourceReferences.map((item) => ({ ...item })),
      reviewState:
        value.reviewState === "READY"
          ? "PASSED"
          : value.reviewState === "BLOCKED"
            ? "BLOCKED"
            : "PENDING",
    };
  }

  public execute(): never {
    throw new MayaAriaSpecialistError(
      "PRODUCTION_EXECUTION_PROHIBITED",
      "MAYA cannot execute production actions or approve for Founder.",
    );
  }

  private validate(input: MayaMarketIntelligenceInput): void {
    required(input.teamRunId, "teamRunId");
    required(input.correlationId, "correlationId");
    required(input.objectiveReference.artifactId, "objectiveReference.artifactId");
    required(input.productReference.artifactId, "productReference.artifactId");
    if (input.assignment.assignedPersona !== "MAYA")
      throw new MayaAriaSpecialistError(
        "MAYA_ASSIGNMENT_INVALID",
        "MAYA requires a MAYA assignment.",
      );
    if (input.targetMarkets.length === 0 || input.requestedDimensions.length === 0)
      throw new MayaAriaSpecialistError(
        "MAYA_SCOPE_INVALID",
        "Target markets and requested dimensions are required.",
      );
    if (!Number.isInteger(input.freshnessThresholdDays) || input.freshnessThresholdDays < 0)
      throw new MayaAriaSpecialistError(
        "MAYA_FRESHNESS_INVALID",
        "Freshness threshold must be a non-negative integer.",
      );
    strictIso(input.evaluatedAt, "evaluatedAt");
    input.evidence.forEach((item) => {
      required(item.artifactId, "evidence.artifactId");
      required(item.claimKey, "evidence.claimKey");
      required(item.statement, "evidence.statement");
      if (item.observedAt !== undefined) strictIso(item.observedAt, "evidence.observedAt");
      if (
        item.observedAt !== undefined &&
        new Date(item.observedAt).valueOf() > new Date(input.evaluatedAt).valueOf()
      )
        throw new MayaAriaSpecialistError(
          "EVIDENCE_TIMESTAMP_FUTURE",
          "Evidence observedAt must not be later than evaluatedAt.",
        );
    });
  }
}

function assessEvidenceQuality(input: MayaMarketIntelligenceInput): EvidenceQualityAssessment {
  const sourceAvailable = input.evidence.length > 0;
  const provenanceAdequate =
    sourceAvailable && input.evidence.every((item) => item.provenance !== "UNKNOWN");
  const freshness = evidenceFreshness(
    input.evidence,
    input.evaluatedAt,
    input.freshnessThresholdDays,
  );
  const grouped = new Map<string, Set<string>>();
  input.evidence.forEach((item) => {
    const values = grouped.get(item.claimKey) ?? new Set<string>();
    values.add(item.value);
    grouped.set(item.claimKey, values);
  });
  const consistent = [...grouped.values()].every((values) => values.size <= 1);
  const covered = new Set(
    input.evidence.flatMap((item) => item.dimensions.map((dimension) => dimension.toUpperCase())),
  );
  const complete = input.requestedDimensions.every((dimension) =>
    covered.has(dimension.toUpperCase()),
  );
  const relevant = input.evidence.some((item) =>
    item.dimensions.some((dimension) =>
      input.requestedDimensions
        .map((entry) => entry.toUpperCase())
        .includes(dimension.toUpperCase()),
    ),
  );
  const reasons: string[] = [];
  if (!sourceAvailable) reasons.push("Evidence is missing.");
  if (!provenanceAdequate) reasons.push("Evidence provenance is incomplete.");
  if (freshness === "STALE" || freshness === "UNKNOWN")
    reasons.push(`Evidence freshness is ${freshness.toLowerCase()}.`);
  if (!consistent) reasons.push("Evidence sources materially conflict.");
  if (!complete) reasons.push("Evidence does not cover every requested dimension.");
  if (!relevant) reasons.push("Evidence is not relevant to requested dimensions.");
  const failures = [
    !sourceAvailable,
    !provenanceAdequate,
    freshness === "STALE" || freshness === "UNKNOWN",
    !consistent,
    !complete,
    !relevant,
  ].filter(Boolean).length;
  const level =
    !sourceAvailable || !relevant
      ? "INSUFFICIENT"
      : failures === 0 && freshness === "CURRENT"
        ? "HIGH"
        : failures <= 1
          ? "MEDIUM"
          : failures <= 3
            ? "LOW"
            : "INSUFFICIENT";
  return {
    level,
    sourceAvailable,
    provenanceAdequate,
    freshness,
    consistent,
    complete,
    relevant,
    reasons,
  };
}

function evidenceFreshness(
  evidence: readonly MarketEvidenceItem[],
  evaluatedAt: string,
  threshold: number,
): EvidenceFreshness {
  if (evidence.length === 0 || evidence.some((item) => item.observedAt === undefined))
    return "UNKNOWN";
  const evaluated = new Date(evaluatedAt).valueOf();
  const oldestDays = Math.max(
    ...evidence.map((item) => (evaluated - new Date(item.observedAt!).valueOf()) / 86_400_000),
  );
  return oldestDays <= threshold ? "CURRENT" : oldestDays <= threshold * 2 ? "AGING" : "STALE";
}
function filterDimension(
  evidence: readonly MarketEvidenceItem[],
  dimension: string,
): readonly string[] {
  return evidence
    .filter((item) => item.dimensions.some((value) => value.toUpperCase() === dimension))
    .map((item) => item.statement);
}
function required(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new MayaAriaSpecialistError("REQUIRED_FIELD_MISSING", `${field} is required.`);
}
function strictIso(value: string, field: string): void {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value)
    throw new MayaAriaSpecialistError("TIMESTAMP_INVALID", `${field} must be strict ISO UTC.`);
}
function dedupe(
  values: readonly {
    readonly artifactId: string;
    readonly artifactType: string;
    readonly version: string;
  }[],
): readonly {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly version: string;
}[] {
  return [
    ...new Map(
      values.map((item) => [`${item.artifactType}:${item.artifactId}:${item.version}`, item]),
    ).values(),
  ].map((item) => ({ ...item }));
}
