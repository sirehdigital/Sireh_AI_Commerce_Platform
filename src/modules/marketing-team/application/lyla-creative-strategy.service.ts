import type {
  LylaCreativeStrategyContribution,
  LylaCreativeStrategyInput,
} from "../domain/luna-lyla-specialist.model.js";
import {
  LUNA_LYLA_VERSION,
  LunaLylaSpecialistError,
} from "../domain/luna-lyla-specialist.model.js";
import type { SpecialistContribution } from "../domain/miss-hermes-director.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

export class LylaCreativeStrategyService {
  public constructor(registry = new MarketingTeamAgentRegistry()) {
    const lyla = registry.get("LYLA");
    if (
      lyla.role !== "CREATIVE_STRATEGY" ||
      lyla.systemLayer !== "CODEX_SACP_SAIE" ||
      lyla.productionExecutionAllowed !== false
    )
      throw new LunaLylaSpecialistError(
        "LYLA_IDENTITY_INVALID",
        "LYLA governance identity is invalid.",
      );
  }
  public interpret(input: LylaCreativeStrategyInput): LylaCreativeStrategyContribution {
    required(input.teamRunId, "teamRunId");
    required(input.correlationId, "correlationId");
    required(input.creativeObjective, "creativeObjective");
    if (input.assignment.assignedPersona !== "LYLA")
      throw new LunaLylaSpecialistError(
        "LYLA_ASSIGNMENT_INVALID",
        "LYLA requires a LYLA assignment.",
      );
    const lunaRequired = input.assignment.dependencies.some((item) =>
      item.endsWith(":assignment:luna"),
    );
    if (lunaRequired && input.lunaHandoff === undefined)
      throw new LunaLylaSpecialistError(
        "LUNA_HANDOFF_REQUIRED",
        "LYLA assignment requires the declared LUNA handoff.",
      );
    if (
      input.lunaHandoff !== undefined &&
      (input.lunaHandoff.teamRunId !== input.teamRunId ||
        input.lunaHandoff.correlationId !== input.correlationId)
    )
      throw new LunaLylaSpecialistError(
        "LUNA_LYLA_CORRELATION_INVALID",
        "LUNA handoff must preserve team-run and correlation identity.",
      );
    if (
      !input.creativeIntelligence.governance.advisoryOnly ||
      !input.creativeIntelligence.governance.noPublishing
    )
      throw new LunaLylaSpecialistError(
        "CREATIVE_INTELLIGENCE_BOUNDARY_INVALID",
        "LYLA requires advisory, non-publishing Creative Intelligence output.",
      );
    const brandRisks = input.creativeIntelligence.creativeQuality.findings
      .filter((item) => item.dimension === "BRAND_CONSISTENCY" && item.type !== "STRENGTH")
      .map((item) => item.message);
    const escalationReasons = [...(input.lunaHandoff?.risks ?? [])];
    const suitabilityRisk = input.creativeIntelligence.platformSuitability.some(
      (item) => item.status !== "SUITABLE",
    );
    if (suitabilityRisk)
      escalationReasons.push(
        "Creative Intelligence reports platform suitability requiring review.",
      );
    if (["HIGH", "CRITICAL"].includes(input.creativeIntelligence.policyRisk.overallRisk))
      escalationReasons.push("Creative Intelligence reports high or critical policy risk.");
    if (brandRisks.length > 0)
      escalationReasons.push("Creative Intelligence reports brand-consistency risk.");
    if (input.assetReferences.length === 0)
      escalationReasons.push("Asset rights and availability require review.");
    if (
      input.creativeRequirements.some((item) => /replace production|publish|execute/iu.test(item))
    )
      escalationReasons.push(
        "Production creative replacement or execution requires Founder-controlled action.",
      );
    const blocked =
      input.creativeIntelligence.policyRisk.overallRisk === "CRITICAL" ||
      input.lunaHandoff?.reviewState === "BLOCKED";
    return {
      contributionId: `${input.teamRunId}:contribution:lyla`,
      persona: "LYLA",
      role: "CREATIVE_STRATEGY",
      teamRunId: input.teamRunId,
      correlationId: input.correlationId,
      ariaReference: input.ariaContribution.contributionId,
      ...(input.lunaHandoff === undefined
        ? {}
        : { lunaReference: input.lunaHandoff.lunaContribution.contributionId }),
      sourceReferences: input.productReferences.map((item) => ({ ...item })),
      targetPlatforms: [...input.targetPlatforms],
      creativeObjective: input.creativeObjective,
      creativeAngle: input.creativeAngle,
      hookDirection: input.hookDirection,
      visualConcept: input.visualConcept,
      formatRecommendation: input.formatRecommendation,
      structure: [...input.structure],
      ctaDirection: input.ctaDirection,
      platformSuitability: structuredClone(input.creativeIntelligence.platformSuitability),
      creativeIntelligenceReference: {
        creativeIntelligenceId: input.creativeIntelligence.creativeIntelligenceId,
        pipelineVersion: input.creativeIntelligence.versionMetadata.pipelineVersion,
      },
      policyRisks: structuredClone(input.creativeIntelligence.policyRisk),
      brandRisks,
      assumptions: input.lunaHandoff?.assumptions.map((item) => item.text) ?? [],
      limitations: input.lunaHandoff?.risks ?? [],
      recommendations: structuredClone(input.creativeIntelligence.recommendations),
      reviewRequirements: [...input.reviewRequirements],
      escalationReasons,
      reviewState: blocked
        ? "BLOCKED"
        : escalationReasons.length > 0 || input.creativeIntelligence.governance.humanReviewRequired
          ? "REVIEW_REQUIRED"
          : "READY",
      attributionVersion: LUNA_LYLA_VERSION,
      executionAllowed: false,
    };
  }
  public toSpecialistContribution(value: LylaCreativeStrategyContribution): SpecialistContribution {
    return {
      contributionId: value.contributionId,
      persona: "LYLA",
      summary: value.creativeObjective,
      recommendation:
        value.recommendations.map((item) => item.recommendedAction).join(" ") ||
        value.formatRecommendation,
      assumptions: [...value.assumptions],
      risks: [...value.escalationReasons],
      confidence:
        value.reviewState === "READY" ? "HIGH" : value.reviewState === "BLOCKED" ? "LOW" : "MEDIUM",
      evidence: value.sourceReferences.map((item) => ({ ...item })),
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
    throw new LunaLylaSpecialistError(
      "PRODUCTION_EXECUTION_PROHIBITED",
      "LYLA cannot publish, replace production creative, execute actions, or approve for Founder.",
    );
  }
}
function required(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new LunaLylaSpecialistError("REQUIRED_FIELD_MISSING", `${field} is required.`);
}
