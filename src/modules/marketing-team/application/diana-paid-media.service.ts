import type {
  DianaMiraHandoff,
  DianaPaidMediaContribution,
  DianaPaidMediaInput,
  PaidMediaChannel,
} from "../domain/diana-paid-media.model.js";
import {
  DIANA_PAID_MEDIA_VERSION,
  DianaPaidMediaError,
} from "../domain/diana-paid-media.model.js";
import type { SpecialistContribution } from "../domain/miss-hermes-director.model.js";
import { MarketingTeamAgentRegistry } from "../domain/marketing-team.registry.js";

const CHANNEL_MAP: Readonly<Record<PaidMediaChannel, readonly string[]>> = {
  META: ["FACEBOOK", "INSTAGRAM"],
  TIKTOK: ["TIKTOK"],
  OTHER_SUPPORTED_CHANNEL: [],
};
const PRODUCTION_REQUEST =
  /publish|schedule|create (?:live )?campaign|mutate|change budget|change targeting|credential|platform api|pause|resume/iu;

export class DianaPaidMediaService {
  public constructor(registry = new MarketingTeamAgentRegistry()) {
    const diana = registry.get("DIANA");
    if (
      diana.role !== "PAID_MEDIA" ||
      diana.systemLayer !== "CODEX_SACP_SAIE" ||
      diana.productionExecutionAllowed !== false
    )
      throw new DianaPaidMediaError("DIANA_IDENTITY_INVALID", "DIANA governance identity is invalid.");
  }

  public interpret(input: DianaPaidMediaInput): DianaPaidMediaContribution {
    required(input.teamRunId, "teamRunId");
    required(input.correlationId, "correlationId");
    required(input.scheduleContext, "scheduleContext");
    if (input.assignment.assignedPersona !== "DIANA")
      throw new DianaPaidMediaError("DIANA_ASSIGNMENT_INVALID", "DIANA requires a DIANA assignment.");
    const dependencies = new Set(input.assignment.dependencies);
    if (!dependencies.has(`${input.teamRunId}:assignment:aria`))
      throw new DianaPaidMediaError("ARIA_DEPENDENCY_REQUIRED", "DIANA requires direct ARIA dependency.");
    if (!dependencies.has(`${input.teamRunId}:assignment:lyla`))
      throw new DianaPaidMediaError("LYLA_DEPENDENCY_REQUIRED", "DIANA requires direct LYLA dependency.");
    if (
      input.ariaContribution.teamRunId !== input.teamRunId ||
      input.lylaContribution.teamRunId !== input.teamRunId ||
      input.ariaContribution.correlationId !== input.correlationId ||
      input.lylaContribution.correlationId !== input.correlationId
    )
      throw new DianaPaidMediaError(
        "SPECIALIST_CORRELATION_INVALID",
        "ARIA and LYLA contributions must preserve team-run and correlation identity.",
      );
    const strategy = input.ariaContribution.canonicalCampaignStrategy;
    if (!strategy.advisoryOnly)
      throw new DianaPaidMediaError(
        "CAMPAIGN_STRATEGY_BOUNDARY_INVALID",
        "DIANA requires advisory CampaignStrategyPipelineResult input.",
      );
    const currency = input.currencyContext ?? input.budgetConstraints.currency;
    if (currency !== undefined && !/^[A-Z]{3}$/u.test(currency))
      throw new DianaPaidMediaError("CURRENCY_CONTEXT_INVALID", "Currency must be a three-letter uppercase code.");

    const missingDataIndicators = input.targetChannels
      .filter((channel) => input.platformAvailability[channel] === "NOT_AVAILABLE")
      .map((channel) => `${channel}: DATA_NOT_AVAILABLE`);
    const canonicalRisks = input.ariaContribution.risks.map((item) => item.reason);
    const escalationReasons = [
      ...input.ariaContribution.escalationReasons,
      ...input.lylaContribution.escalationReasons,
    ];
    if (input.evidenceReferences.length === 0 && input.mayaEvidenceReferences.length === 0)
      escalationReasons.push("Paid-media evidence is insufficient.");
    if (input.trackingPrerequisites.length === 0)
      escalationReasons.push("Tracking prerequisites are unclear.");
    if (missingDataIndicators.length > 0)
      escalationReasons.push("Platform or account availability is unknown.");
    if (
      input.lylaContribution.policyRisks.overallRisk === "HIGH" ||
      input.lylaContribution.policyRisks.overallRisk === "CRITICAL"
    )
      escalationReasons.push("Upstream Creative Intelligence policy risk is high or critical.");
    if (
      input.ariaContribution.requiresHumanReview ||
      input.lylaContribution.reviewState !== "READY"
    )
      escalationReasons.push("Upstream specialist output requires human review.");
    const { founderEnvelope, approvedSpend, proposedTotal, materiallyChangesEconomics } =
      input.budgetConstraints;
    if (
      materiallyChangesEconomics ||
      (founderEnvelope !== undefined && proposedTotal !== undefined && proposedTotal > founderEnvelope) ||
      (approvedSpend !== undefined && proposedTotal !== undefined && proposedTotal !== approvedSpend)
    )
      escalationReasons.push("Budget recommendation changes Founder-approved spend or campaign economics.");
    if (input.campaignConstraints.some((item) => PRODUCTION_REQUEST.test(item)))
      escalationReasons.push("Production campaign, mutation, credential, or targeting authority is requested.");

    const channelPlan = input.targetChannels.map((channel) => {
      const canonical = strategy.channelAllocation.find((item) =>
        CHANNEL_MAP[channel].includes(item.channel),
      );
      return {
        channel,
        ...(canonical === undefined
          ? {}
          : {
              canonicalChannel: canonical.channel,
              allocationPercentage: canonical.allocationPercentage,
              ...(canonical.allocationAmount === undefined
                ? {}
                : { allocationAmount: canonical.allocationAmount }),
            }),
        dataState: input.platformAvailability[channel],
        allocationSource: canonical === undefined
          ? ("DIANA_ADVISORY_RECOMMENDATION" as const)
          : ("EXISTING_CANONICAL_ALLOCATION" as const),
        rationale: canonical?.rationale ?? "Channel requires Founder-reviewed advisory allocation.",
      };
    });
    const founderDecisionsRequired = escalationReasons.filter((reason) =>
      /Founder|Budget|authority/iu.test(reason),
    );
    const blocked = strategy.readinessStatus === "NOT_READY" || input.lylaContribution.reviewState === "BLOCKED";
    return {
      contributionId: `${input.teamRunId}:contribution:diana`,
      persona: "DIANA",
      role: "PAID_MEDIA",
      teamRunId: input.teamRunId,
      correlationId: input.correlationId,
      sourceReferences: input.sourceReferences.map((item) => ({ ...item })),
      ariaContributionReference: input.ariaContribution.contributionId,
      lylaContributionReference: input.lylaContribution.contributionId,
      mayaEvidenceReferences: input.mayaEvidenceReferences.map((item) => ({ ...item })),
      canonicalStrategyReference: {
        campaignStrategyId: strategy.campaignStrategyId,
        pipelineVersion: strategy.metadata.pipelineVersion,
      },
      campaignObjectiveInterpretation: `${strategy.objective} at ${strategy.funnelStage} with ${strategy.intent} intent.`,
      channelPlan,
      budgetAllocationInterpretation: {
        source: "EXISTING_CANONICAL_ALLOCATION",
        canonicalAllocation: structuredClone(strategy.budgetAllocation),
        ...(founderEnvelope === undefined ? {} : { founderEnvelope }),
        ...(proposedTotal === undefined ? {} : { advisoryTotal: proposedTotal }),
        budgetChangeAuthorized: false,
      },
      audienceApproach: [
        input.ariaContribution.audienceMarketInterpretation,
        `Use canonical funnel-stage targeting concepts for ${strategy.funnelStage}; platform audience availability is evidence-bound.`,
      ],
      placementRecommendations: input.targetChannels.map(
        (channel) => `${channel}: use only placements confirmed suitable by Creative Intelligence and Founder review.`,
      ),
      creativeRoleRecommendations: structuredClone(strategy.creativeAllocation),
      testingStrategy: [
        "Creative variation test: compare approved LYLA directions.",
        "Audience strategy test: compare prospecting and retargeting concepts where evidence supports both.",
        "Placement test: compare only approved platform placements.",
        "Messaging-angle test: preserve approved claims and policy constraints.",
        "Budget-allocation experiment: advisory only within the Founder envelope.",
      ],
      scalingConditions: [
        "Sufficient conversion evidence and adequate sample size.",
        "Acceptable CPA and ROAS supported by actual data.",
        "Stable tracking and no critical policy issue.",
        ...(missingDataIndicators.length > 0 ? ["Conditional only: live performance data is unavailable."] : []),
      ],
      stopReviewConditions: [
        "Stop for critical policy risk, tracking failure, budget-authority change, or unsupported targeting assumption.",
      ],
      trackingPrerequisites: [...input.trackingPrerequisites],
      measurementPrerequisites: [...input.measurementPrerequisites],
      assumptions: missingDataIndicators.map((item) => `${item}; no platform metric is inferred.`),
      evidence: [...input.evidenceReferences, ...input.mayaEvidenceReferences].map((item) => ({ ...item })),
      missingDataIndicators,
      risks: [
        ...new Set([
          ...canonicalRisks,
          ...input.lylaContribution.escalationReasons,
          ...escalationReasons,
        ]),
      ],
      limitations: [
        "No live analytics, platform account access, or statistical inference is available in 01E.",
        "All paid-media structures remain advisory and require governed review.",
      ],
      alternatives: ["Defer activation until evidence, tracking, platform availability, and approvals are complete."],
      founderDecisionsRequired,
      reviewRequirements: [...input.reviewRequirements],
      reviewState: blocked ? "BLOCKED" : escalationReasons.length > 0 ? "REVIEW_REQUIRED" : "READY",
      escalationReasons: [...new Set(escalationReasons)],
      attributionVersion: DIANA_PAID_MEDIA_VERSION,
      executionAllowed: false,
    };
  }

  public prepareMiraHandoff(value: DianaPaidMediaContribution): DianaMiraHandoff {
    return {
      handoffId: `${value.teamRunId}:handoff:diana-mira`,
      teamRunId: value.teamRunId,
      correlationId: value.correlationId,
      dianaContribution: structuredClone(value),
      ariaContributionReference: value.ariaContributionReference,
      lylaContributionReference: value.lylaContributionReference,
      evidenceReferences: value.evidence.map((item) => ({ ...item })),
      canonicalAllocationReference: { ...value.canonicalStrategyReference },
      risks: [...value.risks],
      assumptions: [...value.assumptions],
      founderBudgetDecisions: [...value.founderDecisionsRequired],
      missingDataIndicators: [...value.missingDataIndicators],
      reviewRequirement: "MIRA",
      fromPersona: "DIANA",
      toPersona: "MIRA",
      executionAllowed: false,
    };
  }

  public toSpecialistContribution(value: DianaPaidMediaContribution): SpecialistContribution {
    return {
      contributionId: value.contributionId,
      persona: "DIANA",
      summary: value.campaignObjectiveInterpretation,
      recommendation: value.channelPlan.map((item) => `${item.channel}: ${item.rationale}`).join(" "),
      assumptions: [...value.assumptions],
      risks: [...value.risks],
      confidence: value.missingDataIndicators.length > 0 ? "LOW" : value.reviewState === "READY" ? "HIGH" : "MEDIUM",
      evidence: value.evidence.map((item) => ({ ...item })),
      dependencies: value.sourceReferences.map((item) => ({ ...item })),
      reviewState: value.reviewState === "READY" ? "PASSED" : value.reviewState === "BLOCKED" ? "BLOCKED" : "PENDING",
    };
  }

  public execute(): never {
    throw new DianaPaidMediaError(
      "PRODUCTION_EXECUTION_PROHIBITED",
      "DIANA cannot create, publish, mutate, or execute paid-media actions or approve for Founder.",
    );
  }
}

function required(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new DianaPaidMediaError("REQUIRED_FIELD_MISSING", `${field} is required.`);
}
