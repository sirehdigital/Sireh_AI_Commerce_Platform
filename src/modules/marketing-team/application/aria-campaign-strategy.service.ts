import type {
  AriaCampaignStrategyContribution,
  AriaCampaignStrategyInput,
  EvidenceQualityLevel,
  MayaAriaSpecialistHandoff,
} from "../domain/maya-aria-specialist.model.js";
import {
  MAYA_ARIA_VERSION,
  MayaAriaSpecialistError,
} from "../domain/maya-aria-specialist.model.js";
import type { SpecialistContribution } from "../domain/miss-hermes-director.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

export class AriaCampaignStrategyService {
  public constructor(registry = new MarketingTeamAgentRegistry()) {
    const aria = registry.get("ARIA");
    if (
      aria.role !== "CAMPAIGN_STRATEGY" ||
      aria.systemLayer !== "CODEX_SACP_SAIE" ||
      aria.productionExecutionAllowed !== false
    )
      throw new MayaAriaSpecialistError(
        "ARIA_IDENTITY_INVALID",
        "ARIA governance identity is invalid.",
      );
  }

  public interpret(input: AriaCampaignStrategyInput): AriaCampaignStrategyContribution {
    required(input.teamRunId, "teamRunId");
    required(input.correlationId, "correlationId");
    if (input.assignment.assignedPersona !== "ARIA")
      throw new MayaAriaSpecialistError(
        "ARIA_ASSIGNMENT_INVALID",
        "ARIA requires an ARIA assignment.",
      );
    const mayaRequired = input.assignment.dependencies.some((dependency) =>
      dependency.endsWith(":assignment:maya"),
    );
    if (mayaRequired && input.mayaHandoff === undefined)
      throw new MayaAriaSpecialistError(
        "MAYA_HANDOFF_REQUIRED",
        "ARIA assignment requires the declared MAYA intelligence handoff.",
      );
    if (!input.campaignStrategy.advisoryOnly)
      throw new MayaAriaSpecialistError(
        "ARIA_STRATEGY_BOUNDARY_INVALID",
        "ARIA requires the advisory CampaignStrategyPipelineResult.",
      );
    if (
      input.mayaHandoff !== undefined &&
      (input.mayaHandoff.teamRunId !== input.teamRunId ||
        input.mayaHandoff.correlationId !== input.correlationId)
    )
      throw new MayaAriaSpecialistError(
        "MAYA_ARIA_CORRELATION_INVALID",
        "MAYA handoff must preserve team-run and correlation identity.",
      );
    const confidence = preserveConfidence(input.mayaHandoff);
    const escalationReasons = this.escalations(input, confidence);
    const blocked =
      confidence === "INSUFFICIENT" || input.campaignStrategy.readinessStatus === "NOT_READY";
    const requiresHumanReview =
      input.campaignStrategy.requiresHumanReview || escalationReasons.length > 0;
    return {
      contributionId: `${input.teamRunId}:contribution:aria`,
      persona: "ARIA",
      role: "CAMPAIGN_STRATEGY",
      teamRunId: input.teamRunId,
      correlationId: input.correlationId,
      sourceReferences: input.sourceReferences.map((item) => ({ ...item })),
      mayaEvidenceReferences:
        input.mayaHandoff?.mayaContribution.evidence.map(
          ({ artifactId, artifactType, version }) => ({ artifactId, artifactType, version }),
        ) ?? [],
      canonicalCampaignStrategy: structuredClone(input.campaignStrategy),
      strategicSummary: `${input.campaignStrategy.objective} strategy for ${input.campaignStrategy.funnelStage} with ${input.campaignStrategy.channels.join(", ")}.`,
      objective: input.campaignStrategy.objective,
      funnelInterpretation: `Use ${input.campaignStrategy.funnelStage} funnel intent ${input.campaignStrategy.intent}.`,
      audienceMarketInterpretation: input.campaignStrategy.audienceStrategy.messagingAngle,
      channelInterpretation: input.campaignStrategy.channelAllocation
        .map((item) => `${item.channel}: ${item.allocationPercentage}%`)
        .join("; "),
      allocationInterpretation: input.campaignStrategy.creativeAllocation
        .map((item) => `${item.creativeRole}: ${item.recommendedPercentage}%`)
        .join("; "),
      strategicRecommendations: structuredClone(input.campaignStrategy.recommendations),
      risks: structuredClone(input.campaignStrategy.strategicRisks),
      assumptions: input.mayaHandoff?.assumptions ?? [],
      tradeoffs: input.campaignStrategy.recommendations.map(
        (item) => `${item.category}: ${item.reason}`,
      ),
      readiness: input.campaignStrategy.readinessStatus,
      requiresHumanReview,
      confidence,
      evidenceNotes:
        input.mayaHandoff === undefined
          ? ["ARIA workflow does not require MAYA evidence."]
          : [...input.mayaHandoff.evidenceQuality.reasons],
      escalationReasons,
      reviewState: blocked ? "BLOCKED" : requiresHumanReview ? "REVIEW_REQUIRED" : "READY",
      attributionVersion: MAYA_ARIA_VERSION,
      executionAllowed: false,
    };
  }

  public toSpecialistContribution(value: AriaCampaignStrategyContribution): SpecialistContribution {
    return {
      contributionId: value.contributionId,
      persona: "ARIA",
      summary: value.strategicSummary,
      recommendation:
        value.strategicRecommendations.map((item) => item.recommendedAction).join(" ") ||
        value.strategicSummary,
      assumptions: [...value.assumptions],
      risks: value.risks.map((item) => item.reason),
      confidence:
        value.confidence === "HIGH" ? "HIGH" : value.confidence === "MEDIUM" ? "MEDIUM" : "LOW",
      evidence: value.mayaEvidenceReferences.map((item) => ({ ...item })),
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
      "ARIA cannot execute production actions or approve for Founder.",
    );
  }

  private escalations(
    input: AriaCampaignStrategyInput,
    confidence: EvidenceQualityLevel,
  ): readonly string[] {
    const reasons: string[] = [];
    if (confidence === "LOW" || confidence === "INSUFFICIENT")
      reasons.push("MAYA evidence quality is insufficient for confident strategy.");
    if (input.campaignStrategy.requiresHumanReview)
      reasons.push("Canonical strategy requires human review.");
    if (input.campaignStrategy.readinessStatus === "NOT_READY")
      reasons.push("Canonical campaign strategy is not ready.");
    if (
      input.campaignStrategy.strategicRisks.some(
        (item) => item.severity === "HIGH" || item.severity === "CRITICAL",
      )
    )
      reasons.push("Campaign strategy contains high or critical risk.");
    const constraints = [
      ...input.campaignConstraints,
      ...input.marketConstraints,
      ...input.channelConstraints,
    ].join(" ");
    if (/budget authority|production execution|conflict/iu.test(constraints))
      reasons.push("Founder authority or material constraint conflict requires escalation.");
    return reasons;
  }
}

function preserveConfidence(handoff: MayaAriaSpecialistHandoff | undefined): EvidenceQualityLevel {
  return handoff?.evidenceQuality.level ?? "MEDIUM";
}
function required(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new MayaAriaSpecialistError("REQUIRED_FIELD_MISSING", `${field} is required.`);
}
