import type {
  CreateFounderMarketingObjectiveInput,
  FounderMarketingObjectiveIntake,
  MarketingObjectiveOutput,
  MissHermesDelegationPlan,
  MissHermesFounderDecisionBrief,
  MissHermesReadinessEvaluation,
  MissHermesReadinessState,
  RecommendationConflict,
  SpecialistAssignment,
  SpecialistContribution,
} from "../domain/miss-hermes-director.model.js";
import {
  MISS_HERMES_DIRECTOR_VERSION,
  MissHermesDirectorError,
} from "../domain/miss-hermes-director.model.js";
import type {
  MarketingArtifactReference,
  MarketingTeamAgentId,
} from "../domain/marketing-team.model.js";
import { MARKETING_TEAM_VERSION } from "../domain/marketing-team.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

const ROUTES: Readonly<Record<MarketingObjectiveOutput, readonly MarketingTeamAgentId[]>> = {
  MARKET_RESEARCH: ["MAYA"],
  CAMPAIGN_PLAN: ["MAYA", "ARIA"],
  CONTENT: ["ARIA", "LUNA", "MIRA"],
  CREATIVE: ["ARIA", "LUNA", "LYLA", "MIRA"],
  PAID_MEDIA_PLAN: ["MAYA", "ARIA", "LYLA", "DIANA", "MIRA"],
  PERFORMANCE_REVIEW: ["SUZI", "DIANA", "MISS_HERMES"],
};
const ROUTE_DEPENDENCIES: Readonly<
  Record<
    MarketingObjectiveOutput,
    Readonly<Partial<Record<MarketingTeamAgentId, readonly MarketingTeamAgentId[]>>>
  >
> = {
  MARKET_RESEARCH: { MAYA: [] },
  CAMPAIGN_PLAN: { MAYA: [], ARIA: ["MAYA"] },
  CONTENT: { ARIA: [], LUNA: ["ARIA"], MIRA: ["LUNA"] },
  CREATIVE: { ARIA: [], LUNA: ["ARIA"], LYLA: ["LUNA"], MIRA: ["LYLA"] },
  PAID_MEDIA_PLAN: {
    MAYA: [],
    ARIA: ["MAYA"],
    LYLA: ["ARIA"],
    DIANA: ["ARIA", "LYLA"],
    MIRA: ["DIANA"],
  },
  PERFORMANCE_REVIEW: { SUZI: [], DIANA: ["SUZI"], MISS_HERMES: ["DIANA"] },
};
const PERSONA_ORDER: readonly MarketingTeamAgentId[] = [
  "MAYA",
  "ARIA",
  "LUNA",
  "LYLA",
  "SUZI",
  "DIANA",
  "MIRA",
  "MISS_HERMES",
];
const TRANSITIONS: Readonly<Record<MissHermesReadinessState, readonly MissHermesReadinessState[]>> =
  {
    NEEDS_INFORMATION: ["IN_PROGRESS", "BLOCKED"],
    IN_PROGRESS: ["NEEDS_INFORMATION", "NEEDS_REVIEW", "BLOCKED"],
    NEEDS_REVIEW: ["IN_PROGRESS", "READY_FOR_FOUNDER", "BLOCKED"],
    READY_FOR_FOUNDER: ["NEEDS_REVIEW", "BLOCKED"],
    BLOCKED: ["NEEDS_INFORMATION", "IN_PROGRESS"],
  };

export class MissHermesDirectorService {
  public constructor(private readonly registry = new MarketingTeamAgentRegistry()) {
    const director = registry.get("MISS_HERMES");
    if (
      director.role !== "AI_MARKETING_DIRECTOR" ||
      director.systemLayer !== "CODEX_SACP_SAIE" ||
      director.productionExecutionAllowed !== false
    )
      throw new MissHermesDirectorError(
        "DIRECTOR_IDENTITY_INVALID",
        "MISS HERMES governance identity is invalid.",
      );
  }

  public receiveObjective(
    input: CreateFounderMarketingObjectiveInput,
  ): FounderMarketingObjectiveIntake {
    required(input.objectiveId, "objectiveId");
    required(input.objective, "objective");
    required(input.timingContext, "timingContext");
    strictIso(input.receivedAt);
    artifact(input.sourceReference);
    nonEmpty(input.targetMarkets, "targetMarkets");
    nonEmpty(input.requestedOutputs, "requestedOutputs");
    return structuredClone({
      ...input,
      objectiveId: input.objectiveId.trim(),
      objective: input.objective.trim(),
      timingContext: input.timingContext.trim(),
      receivedBy: "MISS_HERMES" as const,
    });
  }

  public createDelegationPlan(
    teamRunId: string,
    correlationId: string,
    objective: FounderMarketingObjectiveIntake,
  ): MissHermesDelegationPlan {
    required(teamRunId, "teamRunId");
    required(correlationId, "correlationId");
    const selected = new Set(objective.requestedOutputs.flatMap((output) => ROUTES[output]));
    const ordered = PERSONA_ORDER.filter((persona) => selected.has(persona));
    const directDependencies = this.mergeDirectDependencies(objective.requestedOutputs, selected);
    const assignments = ordered.map((persona) =>
      this.assignment(teamRunId, persona, objective, directDependencies.get(persona) ?? []),
    );
    return {
      teamRunId,
      correlationId,
      objective: structuredClone(objective),
      assignments,
      sequencingRule: "DEPENDENCY_ORDER_THEN_PERSONA_ORDER",
      attributedTo: "MISS_HERMES",
      role: "AI_MARKETING_DIRECTOR",
      systemLayer: "CODEX_SACP_SAIE",
      productionExecutionAllowed: false,
    };
  }

  public resolveConflict(
    teamRunId: string,
    correlationId: string,
    conflictId: string,
    contributions: readonly SpecialistContribution[],
    preferredOption?: string,
  ): RecommendationConflict {
    required(teamRunId, "teamRunId");
    required(correlationId, "correlationId");
    required(conflictId, "conflictId");
    if (contributions.length < 2)
      throw new MissHermesDirectorError(
        "CONFLICT_POSITIONS_REQUIRED",
        "At least two specialist positions are required.",
      );
    const distinct = new Set(contributions.map((item) => item.recommendation.trim()));
    if (distinct.size < 2)
      throw new MissHermesDirectorError(
        "CONFLICT_NOT_PRESENT",
        "Specialist recommendations do not conflict.",
      );
    const weakEvidence = contributions.some(
      (item) => item.confidence === "LOW" || item.evidence.length === 0,
    );
    return {
      conflictId,
      teamRunId,
      correlationId,
      attributedTo: "MISS_HERMES",
      positions: contributions.map((item) => ({
        persona: item.persona,
        recommendation: item.recommendation,
        evidence: item.evidence.map((entry) => ({ ...entry })),
      })),
      tradeoffs: contributions.map(
        (item) => `${item.persona}: ${item.risks.join("; ") || "No stated risk"}`,
      ),
      ...(preferredOption === undefined ? {} : { preferredOption }),
      rationale:
        preferredOption === undefined
          ? "Material disagreement is preserved for Founder decision."
          : "Preferred option is advisory and retains all specialist positions.",
      dependencyReferences: dedupeArtifacts(contributions.flatMap((item) => item.dependencies)),
      reviewState:
        preferredOption === undefined ? "FOUNDER_REVIEW_REQUIRED" : "ADVISORY_PREFERENCE_RECORDED",
      founderEscalationRequired: preferredOption === undefined || weakEvidence,
    };
  }

  public evaluateReadiness(
    objective: FounderMarketingObjectiveIntake,
    contributions: readonly SpecialistContribution[],
    conflicts: readonly RecommendationConflict[],
  ): MissHermesReadinessEvaluation {
    const reasons: string[] = [];
    if (contributions.length === 0)
      return {
        state: "NEEDS_INFORMATION",
        reasons: ["Specialist contributions are missing."],
        founderEscalationRequired: false,
        executed: false,
      };
    const mira = contributions.find((item) => item.persona === "MIRA");
    if (mira?.reviewState === "BLOCKED")
      return {
        state: "BLOCKED",
        reasons: ["MIRA reported a blocking risk."],
        founderEscalationRequired: true,
        executed: false,
      };
    if (conflicts.some((item) => item.founderEscalationRequired))
      reasons.push("Material specialist conflict requires Founder decision.");
    if (contributions.some((item) => item.confidence === "LOW" || item.evidence.length === 0))
      reasons.push("Evidence quality is insufficient.");
    if (objective.budgetConstraints.length > 0)
      reasons.push("Budget authority requires Founder review.");
    const governedConstraints = [...objective.campaignConstraints, ...objective.riskRequirements]
      .join(" ")
      .toLowerCase();
    if (
      /production|credential|platform configuration|change targeting|scope change/u.test(
        governedConstraints,
      )
    )
      reasons.push(
        "Production, credential, targeting, platform, or material scope authority requires Founder escalation.",
      );
    const needsMira = objective.requestedOutputs.some(
      (item) => item === "CONTENT" || item === "CREATIVE" || item === "PAID_MEDIA_PLAN",
    );
    if (needsMira && mira?.reviewState !== "PASSED")
      return {
        state: "NEEDS_REVIEW",
        reasons: [...reasons, "MIRA review is required."],
        founderEscalationRequired: reasons.length > 0,
        executed: false,
      };
    return {
      state: "READY_FOR_FOUNDER",
      reasons:
        reasons.length === 0 ? ["Required specialist work is ready for Founder review."] : reasons,
      founderEscalationRequired: true,
      executed: false,
    };
  }

  public transitionReadiness(
    current: MissHermesReadinessState,
    next: MissHermesReadinessState,
  ): MissHermesReadinessState {
    if (!TRANSITIONS[current].includes(next))
      throw new MissHermesDirectorError(
        "READINESS_TRANSITION_INVALID",
        `Cannot transition readiness from ${current} to ${next}.`,
      );
    return next;
  }

  public composeFounderDecisionBrief(
    teamRunId: string,
    correlationId: string,
    objective: FounderMarketingObjectiveIntake,
    contributions: readonly SpecialistContribution[],
    conflicts: readonly RecommendationConflict[],
    executiveSummary: string,
    recommendedStrategy: string,
  ): MissHermesFounderDecisionBrief {
    required(executiveSummary, "executiveSummary");
    required(recommendedStrategy, "recommendedStrategy");
    const readiness = this.evaluateReadiness(objective, contributions, conflicts);
    const mira = contributions.find((item) => item.persona === "MIRA");
    const evidence = dedupeArtifacts(contributions.flatMap((item) => item.evidence));
    const dependencies = dedupeArtifacts(contributions.flatMap((item) => item.dependencies));
    return {
      briefId: `miss-hermes-brief:${teamRunId}`,
      teamRunId,
      correlationId,
      objective: structuredClone(objective),
      executiveSummary: executiveSummary.trim(),
      specialistContributions: structuredClone(contributions),
      recommendedStrategy: recommendedStrategy.trim(),
      alternatives: conflicts
        .flatMap((item) => item.positions.map((position) => position.recommendation))
        .filter((item) => item !== recommendedStrategy),
      conflicts: structuredClone(conflicts),
      assumptions: [...new Set(contributions.flatMap((item) => item.assumptions))],
      risks: [...new Set(contributions.flatMap((item) => item.risks))],
      miraStatus: mira?.reviewState ?? "NOT_REQUIRED",
      approvalRequirements: ["Founder approval is required before any production action."],
      founderDecisionsRequired: readiness.founderEscalationRequired
        ? readiness.reasons
        : ["Approve, reject, or request changes to the recommendation."],
      readiness,
      attribution: {
        agent: "MISS_HERMES",
        source: { ...objective.sourceReference },
        version: `${MARKETING_TEAM_VERSION}+${MISS_HERMES_DIRECTOR_VERSION}`,
        teamRunId,
        evidence,
        dependencies,
      },
      decisionOptions: ["APPROVE", "REJECT", "REQUEST_CHANGES"],
      approvalDecisionRecorded: false,
      approvedByMissHermes: false,
      executionAllowed: false,
    };
  }

  public execute(): never {
    throw new MissHermesDirectorError(
      "PRODUCTION_EXECUTION_PROHIBITED",
      "MISS HERMES cannot execute production actions or approve on behalf of Founder.",
    );
  }

  private assignment(
    teamRunId: string,
    persona: MarketingTeamAgentId,
    objective: FounderMarketingObjectiveIntake,
    directDependencies: readonly MarketingTeamAgentId[],
  ): SpecialistAssignment {
    const definition = this.registry.get(persona);
    const expectedOutput =
      persona === "MISS_HERMES"
        ? "FOUNDER_DECISION_BRIEF"
        : (objective.requestedOutputs.find((output) => ROUTES[output].includes(persona)) ??
          objective.requestedOutputs[0]);
    if (expectedOutput === undefined)
      throw new MissHermesDirectorError("EXPECTED_OUTPUT_MISSING", "Assignment output is missing.");
    const reviewRequirement =
      persona === "MIRA" ? "FOUNDER" : (definition.reviewRequirements[0] ?? "MISS_HERMES");
    return {
      assignmentId: `${teamRunId}:assignment:${persona.toLowerCase()}`,
      assignedPersona: persona,
      requestedCapability:
        persona === "MIRA"
          ? "REVIEW"
          : persona === "MISS_HERMES"
            ? "PREPARE"
            : definition.capabilities.includes("PREPARE")
              ? "PREPARE"
              : "ANALYSE",
      inputReferences: [{ ...objective.sourceReference }],
      expectedOutput,
      dependencies: directDependencies.map(
        (item) => `${teamRunId}:assignment:${item.toLowerCase()}`,
      ),
      reviewRequirement,
      reviewState: "PLANNED",
      decisionRationale: `${persona} is required by the selected output route and its declared dependencies.`,
      escalationCondition: definition.escalationConditions.join("; "),
      executionAllowed: false,
    };
  }

  private mergeDirectDependencies(
    outputs: readonly MarketingObjectiveOutput[],
    selected: ReadonlySet<MarketingTeamAgentId>,
  ): ReadonlyMap<MarketingTeamAgentId, readonly MarketingTeamAgentId[]> {
    const merged = new Map<MarketingTeamAgentId, Set<MarketingTeamAgentId>>();
    for (const output of outputs) {
      for (const persona of ROUTES[output]) {
        const dependencies = merged.get(persona) ?? new Set<MarketingTeamAgentId>();
        for (const dependency of ROUTE_DEPENDENCIES[output][persona] ?? []) {
          if (selected.has(dependency)) dependencies.add(dependency);
        }
        merged.set(persona, dependencies);
      }
    }
    return new Map(
      [...merged.entries()].map(([persona, dependencies]) => [
        persona,
        PERSONA_ORDER.filter((candidate) => dependencies.has(candidate)),
      ]),
    );
  }
}

function required(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new MissHermesDirectorError("REQUIRED_FIELD_MISSING", `${field} is required.`);
}
function nonEmpty(value: readonly unknown[], field: string): void {
  if (value.length === 0)
    throw new MissHermesDirectorError("REQUIRED_COLLECTION_EMPTY", `${field} must not be empty.`);
}
function strictIso(value: string): void {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value)
    throw new MissHermesDirectorError("TIMESTAMP_INVALID", "receivedAt must be strict ISO UTC.");
}
function artifact(value: MarketingArtifactReference): void {
  required(value.artifactId, "sourceReference.artifactId");
  required(value.artifactType, "sourceReference.artifactType");
  required(value.version, "sourceReference.version");
}
function dedupeArtifacts(
  values: readonly MarketingArtifactReference[],
): readonly MarketingArtifactReference[] {
  const unique = new Map(
    values.map((item) => [`${item.artifactType}:${item.artifactId}:${item.version}`, item]),
  );
  return [...unique.values()].map((item) => ({ ...item }));
}
