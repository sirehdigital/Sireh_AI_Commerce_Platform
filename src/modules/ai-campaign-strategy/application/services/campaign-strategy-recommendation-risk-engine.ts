import type { CreateCampaignStrategyRequest } from "../dto/create-campaign-strategy.request.js";
import { BudgetChannelCreativeAllocationEngine } from "./budget-channel-creative-allocation-engine.js";
import type { AudienceMarketSegment, AudienceMarketStrategy } from "../../domain/models/audience-market-strategy.model.js";
import type { BudgetAllocationInput, BudgetChannelCreativeAllocation, CreativeAllocationRole } from "../../domain/models/budget-channel-creative-allocation.model.js";
import type { CampaignStrategicFunnelStage, CampaignStrategicObjective } from "../../domain/models/campaign-objective-funnel-strategy.model.js";
import type { CampaignChannel } from "../../domain/models/campaign-strategy.model.js";
import {
  CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION,
  type CampaignStrategyReadiness,
  type CampaignStrategyRecommendation,
  type CampaignStrategyRecommendationCategory,
  type CampaignStrategyRecommendationEvidence,
  type CampaignStrategyRecommendationPriority,
  type CampaignStrategyRecommendationRiskResult,
  type CampaignStrategyRiskCategory,
  type CampaignStrategyRiskFinding,
  type CampaignStrategyRiskSeverity,
} from "../../domain/models/campaign-strategy-recommendation-risk.model.js";

interface RiskDefinition {
  readonly code: string;
  readonly category: CampaignStrategyRiskCategory;
  readonly severity: CampaignStrategyRiskSeverity;
  readonly recommendationCategory: CampaignStrategyRecommendationCategory;
  readonly recommendationCode: string;
  readonly reason: string;
  readonly recommendedAction: string;
  readonly evidence: readonly CampaignStrategyRecommendationEvidence[];
  readonly relatedMarket?: string;
  readonly relatedChannel?: CampaignChannel;
}

const RISK_ORDER: readonly CampaignStrategyRiskCategory[] = [
  "INVALID_STRATEGY_COMBINATION",
  "OBJECTIVE_FUNNEL_MISMATCH",
  "AUDIENCE_FUNNEL_MISMATCH",
  "MARKET_EVIDENCE_INSUFFICIENT",
  "CHANNEL_CONCENTRATION",
  "CHANNEL_ROLE_MISMATCH",
  "BUDGET_TOO_FRAGMENTED",
  "BUDGET_ALLOCATION_IMBALANCE",
  "CREATIVE_MIX_MISMATCH",
  "RETARGETING_GAP",
  "RETENTION_GAP",
  "OTHER",
];

const SEVERITY_RANK: Record<CampaignStrategyRiskSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const FUNNEL_OBJECTIVE_ALIGNMENT: Record<CampaignStrategicFunnelStage, readonly CampaignStrategicObjective[]> = {
  TOFU: ["AWARENESS", "TRAFFIC"],
  MOFU: ["ENGAGEMENT", "LEAD_GENERATION"],
  BOFU: ["CONVERSION"],
  RETENTION: ["RETENTION"],
};

const FUNNEL_AUDIENCE_ALIGNMENT: Record<CampaignStrategicFunnelStage, readonly AudienceMarketSegment[]> = {
  TOFU: ["DISCOVERY", "PROBLEM_AWARE"],
  MOFU: ["SOLUTION_AWARE", "PRODUCT_AWARE"],
  BOFU: ["HIGH_INTENT_BUYER"],
  RETENTION: ["EXISTING_CUSTOMER", "REPEAT_BUYER"],
};

const FUNNEL_CREATIVE_ALIGNMENT: Record<CampaignStrategicFunnelStage, readonly CreativeAllocationRole[]> = {
  TOFU: ["AWARENESS", "EDUCATIONAL"],
  MOFU: ["EDUCATIONAL", "PRODUCT_DEMONSTRATION"],
  BOFU: ["OFFER", "RETARGETING"],
  RETENTION: ["RETENTION", "OFFER"],
};

export class CampaignStrategyRecommendationRiskEngine {
  private readonly allocationEngine = new BudgetChannelCreativeAllocationEngine();

  public evaluateStrategy(request: CreateCampaignStrategyRequest, budgetInput: BudgetAllocationInput = {}): CampaignStrategyRecommendationRiskResult {
    return this.evaluateFromAllocation(this.allocationEngine.allocateStrategy(request, budgetInput));
  }

  public evaluateFromAllocation(allocation: BudgetChannelCreativeAllocation): CampaignStrategyRecommendationRiskResult {
    const riskDefinitions = this.deduplicateRisks(this.collectRisks(allocation));
    const riskFindings = riskDefinitions.map((risk) => this.toRiskFinding(risk));
    const recommendations = riskDefinitions.map((risk) => this.toRecommendation(risk, allocation));

    return {
      campaignStrategyId: allocation.campaignStrategyId,
      product: this.cloneProduct(allocation.product),
      objectiveFunnelStrategy: this.cloneObjectiveFunnelStrategy(allocation.objectiveFunnelStrategy),
      audienceMarketStrategy: this.cloneAudienceMarketStrategy(allocation.audienceMarketStrategy),
      budgetChannelCreativeAllocation: this.cloneAllocation(allocation),
      markets: allocation.markets.map((market) => ({ ...market })),
      channels: [...allocation.channels],
      recommendations,
      riskFindings,
      readiness: this.determineReadiness(riskFindings),
      advisoryOnly: true,
      metadata: {
        strategyVersion: CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION,
        allocationStrategyVersion: allocation.metadata.strategyVersion,
        objectiveFunnelStrategyVersion: allocation.objectiveFunnelStrategy.metadata.strategyVersion,
        audienceMarketStrategyVersion: allocation.audienceMarketStrategy.metadata.strategyVersion,
        orderingRule: "RISK_ORDER_THEN_RECOMMENDATION_ORDER_BY_STABLE_CODE",
      },
    };
  }

  private collectRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    return [
      ...this.invalidStrategyCombinationRisks(allocation),
      ...this.objectiveFunnelMismatchRisks(allocation),
      ...this.audienceFunnelMismatchRisks(allocation),
      ...this.marketEvidenceRisks(allocation),
      ...this.channelConcentrationRisks(allocation),
      ...this.channelRoleMismatchRisks(allocation),
      ...this.fragmentedBudgetRisks(allocation),
      ...this.budgetImbalanceRisks(allocation),
      ...this.creativeMixRisks(allocation),
      ...this.retargetingGapRisks(allocation),
      ...this.retentionGapRisks(allocation),
    ];
  }

  private invalidStrategyCombinationRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    const mismatchedIdentity =
      allocation.objectiveFunnelStrategy.campaignStrategyId !== allocation.campaignStrategyId ||
      allocation.audienceMarketStrategy.campaignStrategyId !== allocation.campaignStrategyId;

    if (!mismatchedIdentity) {
      return [];
    }

    return [
      this.risk({
        code: "RISK_INVALID_STRATEGY_IDENTITY",
        category: "INVALID_STRATEGY_COMBINATION",
        severity: "CRITICAL",
        recommendationCategory: "HUMAN_REVIEW_REQUIRED",
        recommendationCode: "REC_HUMAN_REVIEW_INVALID_STRATEGY_IDENTITY",
        reason: "Composed strategy outputs do not share the same canonical campaign strategy identity.",
        recommendedAction: "Stop campaign strategy approval until the composed A-D outputs are regenerated from the same campaign strategy record.",
        evidence: [this.evidence("identity", "IDENTITY_MISMATCH", "A-D strategy IDs must match the allocation campaign strategy ID.")],
      }),
    ];
  }

  private objectiveFunnelMismatchRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    const objective = allocation.objectiveFunnelStrategy.selectedObjective;
    const funnel = allocation.objectiveFunnelStrategy.funnelStage;

    if (FUNNEL_OBJECTIVE_ALIGNMENT[funnel].includes(objective)) {
      return [];
    }

    const severity: CampaignStrategyRiskSeverity = objective === "RETENTION" || objective === "CONVERSION" ? "CRITICAL" : "HIGH";
    return [
      this.risk({
        code: `RISK_OBJECTIVE_FUNNEL_MISMATCH_${objective}_${funnel}`,
        category: "OBJECTIVE_FUNNEL_MISMATCH",
        severity,
        recommendationCategory: "OBJECTIVE_ALIGNMENT",
        recommendationCode: `REC_OBJECTIVE_FUNNEL_ALIGNMENT_${objective}_${funnel}`,
        reason: `${objective} objective is not aligned to ${funnel} funnel strategy.`,
        recommendedAction: "Review objective and funnel selection before approving the campaign strategy.",
        evidence: [this.evidence("objectiveFunnelStrategy", "OBJECTIVE_FUNNEL_ALIGNMENT", `${objective} was paired with ${funnel}.`)],
      }),
    ];
  }

  private audienceFunnelMismatchRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    const audience = allocation.audienceMarketStrategy.audienceSegment;
    const funnel = allocation.objectiveFunnelStrategy.funnelStage;

    if (FUNNEL_AUDIENCE_ALIGNMENT[funnel].includes(audience)) {
      return [];
    }

    return [
      this.risk({
        code: `RISK_AUDIENCE_FUNNEL_MISMATCH_${audience}_${funnel}`,
        category: "AUDIENCE_FUNNEL_MISMATCH",
        severity: "HIGH",
        recommendationCategory: "AUDIENCE_ALIGNMENT",
        recommendationCode: `REC_AUDIENCE_FUNNEL_ALIGNMENT_${audience}_${funnel}`,
        reason: `${audience} audience segment is not aligned to ${funnel} funnel strategy.`,
        recommendedAction: "Review audience segment, funnel stage, and messaging assumptions before execution approval.",
        evidence: [this.evidence("audienceMarketStrategy", "AUDIENCE_FUNNEL_ALIGNMENT", `${audience} was paired with ${funnel}.`)],
      }),
    ];
  }

  private marketEvidenceRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    return allocation.markets
      .filter((market) => market.priority === "EXPERIMENTAL" || market.priority === "NOT_RECOMMENDED")
      .map((market) =>
        this.risk({
          code: `RISK_MARKET_EVIDENCE_${market.priority}_${market.market}`,
          category: "MARKET_EVIDENCE_INSUFFICIENT",
          severity: market.priority === "NOT_RECOMMENDED" ? "HIGH" : "MEDIUM",
          recommendationCategory: "MARKET_ALIGNMENT",
          recommendationCode: `REC_MARKET_REVIEW_${market.priority}_${market.market}`,
          reason: `${market.market} has ${market.priority.toLowerCase()} market priority from supplied associations.`,
          recommendedAction: "Review product and audience market evidence before using this market in the campaign strategy.",
          evidence: [this.evidence("audienceMarketStrategy.geographicPriority", "MARKET_PRIORITY", market.reason)],
          relatedMarket: market.market,
        }),
      );
  }

  private channelConcentrationRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    const largest = [...allocation.channelAllocations].sort((left, right) => right.allocationPercentage - left.allocationPercentage)[0];
    if (largest === undefined || largest.allocationPercentage < 60) {
      return [];
    }

    return [
      this.risk({
        code: `RISK_CHANNEL_CONCENTRATION_${largest.channel}`,
        category: "CHANNEL_CONCENTRATION",
        severity: largest.allocationPercentage >= 75 ? "HIGH" : "MEDIUM",
        recommendationCategory: "CHANNEL_ALLOCATION",
        recommendationCode: `REC_CHANNEL_DIVERSIFICATION_${largest.channel}`,
        reason: `${largest.channel} receives ${largest.allocationPercentage.toFixed(2)}% of channel allocation.`,
        recommendedAction: "Review whether the channel mix should be diversified before approval.",
        evidence: [this.evidence("budgetChannelCreativeAllocation.channelAllocations", "CHANNEL_CONCENTRATION", largest.rationale)],
        relatedChannel: largest.channel,
      }),
    ];
  }

  private channelRoleMismatchRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    return allocation.channelAllocations.flatMap((channelAllocation) => {
      const channelFit = allocation.audienceMarketStrategy.channelFit.find((fit) => fit.channel === channelAllocation.channel);
      if (channelFit === undefined) {
        return [
          this.risk({
            code: `RISK_CHANNEL_ROLE_MISSING_FIT_${channelAllocation.channel}`,
            category: "CHANNEL_ROLE_MISMATCH",
            severity: "MEDIUM",
            recommendationCategory: "CHANNEL_ALLOCATION",
            recommendationCode: `REC_CHANNEL_ROLE_REVIEW_${channelAllocation.channel}`,
            reason: `${channelAllocation.channel} has allocation without matching channel-fit evidence.`,
            recommendedAction: "Review channel association and channel-fit derivation before approval.",
            evidence: [this.evidence("budgetChannelCreativeAllocation.channelAllocations", "CHANNEL_FIT_MISSING", channelAllocation.rationale)],
            relatedChannel: channelAllocation.channel,
          }),
        ];
      }

      const mismatchedPrimary = channelAllocation.priority === "PRIMARY" && channelFit.fit !== "PRIMARY";
      const mismatchedRetargeting = channelAllocation.priority === "RETARGETING" && channelFit.fit !== "RETARGETING";
      const downgradedPrimary = channelFit.fit === "PRIMARY" && channelAllocation.priority !== "PRIMARY";
      if (!mismatchedPrimary && !mismatchedRetargeting && !downgradedPrimary) {
        return [];
      }

      return [
        this.risk({
          code: `RISK_CHANNEL_ROLE_MISMATCH_${channelAllocation.channel}`,
          category: "CHANNEL_ROLE_MISMATCH",
          severity: "MEDIUM",
          recommendationCategory: "CHANNEL_ALLOCATION",
          recommendationCode: `REC_CHANNEL_ROLE_REVIEW_${channelAllocation.channel}`,
          reason: `${channelAllocation.channel} allocation priority ${channelAllocation.priority} conflicts with channel fit ${channelFit.fit}.`,
          recommendedAction: "Align channel fit and allocation priority before approval.",
          evidence: [this.evidence("audienceMarketStrategy.channelFit", "CHANNEL_ROLE_MISMATCH", channelFit.reason)],
          relatedChannel: channelAllocation.channel,
        }),
      ];
    });
  }

  private fragmentedBudgetRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    const smallAllocations = allocation.channelAllocations.filter((channel) => channel.allocationPercentage > 0 && channel.allocationPercentage < 15);
    if (allocation.channelAllocations.length < 5 || smallAllocations.length < 3) {
      return [];
    }

    return [
      this.risk({
        code: "RISK_BUDGET_TOO_FRAGMENTED",
        category: "BUDGET_TOO_FRAGMENTED",
        severity: "MEDIUM",
        recommendationCategory: "BUDGET_ALLOCATION",
        recommendationCode: "REC_BUDGET_CONSOLIDATION",
        reason: `${smallAllocations.length} channels receive less than 15.00% allocation.`,
        recommendedAction: "Consider consolidating low-share channel allocations before approval.",
        evidence: [this.evidence("budgetChannelCreativeAllocation.channelAllocations", "LOW_SHARE_CHANNEL_COUNT", `${smallAllocations.length} low-share allocation(s).`)],
      }),
    ];
  }

  private budgetImbalanceRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    const largest = Math.max(...allocation.channelAllocations.map((channel) => channel.allocationPercentage));
    const smallest = Math.min(...allocation.channelAllocations.map((channel) => channel.allocationPercentage));
    if (!Number.isFinite(largest) || largest < 50 || smallest > 10) {
      return [];
    }

    return [
      this.risk({
        code: "RISK_BUDGET_ALLOCATION_IMBALANCE",
        category: "BUDGET_ALLOCATION_IMBALANCE",
        severity: largest >= 70 ? "HIGH" : "MEDIUM",
        recommendationCategory: "BUDGET_ALLOCATION",
        recommendationCode: "REC_BUDGET_BALANCE_REVIEW",
        reason: `Channel allocation ranges from ${smallest.toFixed(2)}% to ${largest.toFixed(2)}%.`,
        recommendedAction: "Review whether the allocation spread matches the approved campaign strategy.",
        evidence: [this.evidence("budgetChannelCreativeAllocation.channelAllocations", "ALLOCATION_SPREAD", `${smallest.toFixed(2)}-${largest.toFixed(2)} channel percentage spread.`)],
      }),
    ];
  }

  private creativeMixRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    const funnel = allocation.objectiveFunnelStrategy.funnelStage;
    const roles = allocation.creativeMix.map((creative) => creative.creativeRole);
    const missingRoles = FUNNEL_CREATIVE_ALIGNMENT[funnel].filter((role) => !roles.includes(role));
    if (missingRoles.length === 0) {
      return [];
    }

    return [
      this.risk({
        code: `RISK_CREATIVE_MIX_MISMATCH_${funnel}`,
        category: "CREATIVE_MIX_MISMATCH",
        severity: "MEDIUM",
        recommendationCategory: "CREATIVE_MIX",
        recommendationCode: `REC_CREATIVE_MIX_REVIEW_${funnel}`,
        reason: `${funnel} creative mix is missing ${missingRoles.join(", ")} role support.`,
        recommendedAction: "Review creative role mix before campaign approval; do not generate or rewrite assets automatically.",
        evidence: [this.evidence("budgetChannelCreativeAllocation.creativeMix", "CREATIVE_ROLE_MISSING", `Missing ${missingRoles.join(", ")}.`)],
      }),
    ];
  }

  private retargetingGapRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    if (allocation.objectiveFunnelStrategy.funnelStage !== "BOFU") {
      return [];
    }

    const hasRetargetingChannel = allocation.channelAllocations.some((channel) => channel.priority === "RETARGETING" || channel.channel === "RETARGETING");
    const hasRetargetingCreative = allocation.creativeMix.some((creative) => creative.creativeRole === "RETARGETING");
    if (hasRetargetingChannel && hasRetargetingCreative) {
      return [];
    }

    return [
      this.risk({
        code: "RISK_RETARGETING_GAP_BOFU",
        category: "RETARGETING_GAP",
        severity: "HIGH",
        recommendationCategory: "RETARGETING_STRATEGY",
        recommendationCode: "REC_RETARGETING_REVIEW_BOFU",
        reason: "BOFU strategy lacks retargeting channel or creative-role support.",
        recommendedAction: "Review retargeting support before approving the BOFU campaign strategy.",
        evidence: [this.evidence("budgetChannelCreativeAllocation", "RETARGETING_SUPPORT", "BOFU requires retargeting channel and creative-role evidence when available.")],
      }),
    ];
  }

  private retentionGapRisks(allocation: BudgetChannelCreativeAllocation): readonly RiskDefinition[] {
    if (allocation.objectiveFunnelStrategy.funnelStage !== "RETENTION") {
      return [];
    }

    const hasRetentionChannel = allocation.channelAllocations.some((channel) => channel.priority === "PRIMARY" && (channel.channel === "EMAIL" || channel.channel === "SHOPIFY_ONSITE"));
    const hasRetentionCreative = allocation.creativeMix.some((creative) => creative.creativeRole === "RETENTION");
    if (hasRetentionChannel && hasRetentionCreative) {
      return [];
    }

    return [
      this.risk({
        code: "RISK_RETENTION_GAP",
        category: "RETENTION_GAP",
        severity: "HIGH",
        recommendationCategory: "RETENTION_STRATEGY",
        recommendationCode: "REC_RETENTION_SUPPORT_REVIEW",
        reason: "Retention strategy lacks retention-oriented channel or creative-role support.",
        recommendedAction: "Review owned-channel and retention creative support before approval.",
        evidence: [this.evidence("budgetChannelCreativeAllocation", "RETENTION_SUPPORT", "Retention requires owned/supporting channel and retention creative-role evidence.")],
      }),
    ];
  }

  private determineReadiness(risks: readonly CampaignStrategyRiskFinding[]): CampaignStrategyReadiness {
    const highest = this.highestSeverity(risks);
    const requiresHumanReview = risks.some((risk) => risk.severity === "HIGH" || risk.severity === "CRITICAL");

    if (highest === undefined) {
      return {
        status: "READY",
        requiresHumanReview: false,
        reason: "No strategic risk findings were produced from the composed A-D strategy outputs.",
        advisoryOnly: true,
      };
    }

    if (highest === "CRITICAL") {
      return {
        status: "NOT_READY",
        requiresHumanReview: true,
        reason: "At least one CRITICAL strategic risk requires human review before approval.",
        highestRiskSeverity: highest,
        advisoryOnly: true,
      };
    }

    return {
      status: "READY_WITH_REVIEW",
      requiresHumanReview,
      reason: `${highest} strategic risk findings require advisory review before campaign approval.`,
      highestRiskSeverity: highest,
      advisoryOnly: true,
    };
  }

  private toRiskFinding(risk: RiskDefinition): CampaignStrategyRiskFinding {
    return {
      code: risk.code,
      category: risk.category,
      severity: risk.severity,
      reason: risk.reason,
      evidence: risk.evidence.map((evidence) => ({ ...evidence })),
      recommendedAction: risk.recommendedAction,
      advisoryOnly: true,
    };
  }

  private toRecommendation(risk: RiskDefinition, allocation: BudgetChannelCreativeAllocation): CampaignStrategyRecommendation {
    return {
      code: risk.recommendationCode,
      category: risk.recommendationCategory,
      priority: this.priorityFromSeverity(risk.severity),
      reason: risk.reason,
      recommendedAction: risk.recommendedAction,
      evidence: risk.evidence.map((evidence) => ({ ...evidence })),
      relatedObjective: allocation.objectiveFunnelStrategy.selectedObjective,
      relatedFunnel: allocation.objectiveFunnelStrategy.funnelStage,
      relatedAudience: allocation.audienceMarketStrategy.audienceSegment,
      ...(risk.relatedMarket === undefined ? {} : { relatedMarket: risk.relatedMarket }),
      ...(risk.relatedChannel === undefined ? {} : { relatedChannel: risk.relatedChannel }),
      advisoryOnly: true,
    };
  }

  private deduplicateRisks(risks: readonly RiskDefinition[]): readonly RiskDefinition[] {
    const byCode = new Map<string, RiskDefinition>();
    for (const risk of risks) {
      if (!byCode.has(risk.code)) {
        byCode.set(risk.code, risk);
      }
    }

    return [...byCode.values()].sort(
      (left, right) =>
        RISK_ORDER.indexOf(left.category) - RISK_ORDER.indexOf(right.category) ||
        SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
        left.code.localeCompare(right.code),
    );
  }

  private highestSeverity(risks: readonly CampaignStrategyRiskFinding[]): CampaignStrategyRiskSeverity | undefined {
    return risks.reduce<CampaignStrategyRiskSeverity | undefined>(
      (highest, risk) => (highest === undefined || SEVERITY_RANK[risk.severity] > SEVERITY_RANK[highest] ? risk.severity : highest),
      undefined,
    );
  }

  private priorityFromSeverity(severity: CampaignStrategyRiskSeverity): CampaignStrategyRecommendationPriority {
    return severity;
  }

  private risk(input: RiskDefinition): RiskDefinition {
    return input;
  }

  private evidence(source: string, code: string, summary: string): CampaignStrategyRecommendationEvidence {
    return { source, code, summary };
  }

  private cloneProduct(product: BudgetChannelCreativeAllocation["product"]): BudgetChannelCreativeAllocation["product"] {
    return {
      productId: product.productId,
      productName: product.productName,
      category: product.category,
      ...(product.description === undefined ? {} : { description: product.description }),
      keyBenefits: [...product.keyBenefits],
      differentiators: [...product.differentiators],
      knownRisks: [...product.knownRisks],
      ...(product.targetPrice === undefined ? {} : { targetPrice: product.targetPrice }),
      ...(product.currency === undefined ? {} : { currency: product.currency }),
      markets: [...product.markets],
    };
  }

  private cloneObjectiveFunnelStrategy(strategy: BudgetChannelCreativeAllocation["objectiveFunnelStrategy"]): BudgetChannelCreativeAllocation["objectiveFunnelStrategy"] {
    return {
      ...strategy,
      product: this.cloneProduct(strategy.product),
      channels: [...strategy.channels],
      markets: [...strategy.markets],
      reasoning: [...strategy.reasoning],
      supportingSignals: strategy.supportingSignals.map((signal) => ({ ...signal })),
      metadata: { ...strategy.metadata },
    };
  }

  private cloneAudienceMarketStrategy(strategy: AudienceMarketStrategy): AudienceMarketStrategy {
    return {
      ...strategy,
      product: this.cloneProduct(strategy.product),
      secondaryMarkets: [...strategy.secondaryMarkets],
      geographicPriority: strategy.geographicPriority.map((market) => ({ ...market })),
      audienceNeeds: [...strategy.audienceNeeds],
      painPoints: [...strategy.painPoints],
      audienceMotivation: [...strategy.audienceMotivation],
      channelFit: strategy.channelFit.map((channel) => ({ ...channel })),
      reason: [...strategy.reason],
      evidence: strategy.evidence.map((evidence) => ({ ...evidence })),
      metadata: { ...strategy.metadata },
    };
  }

  private cloneAllocation(allocation: BudgetChannelCreativeAllocation): BudgetChannelCreativeAllocation {
    return {
      ...allocation,
      product: this.cloneProduct(allocation.product),
      objectiveFunnelStrategy: this.cloneObjectiveFunnelStrategy(allocation.objectiveFunnelStrategy),
      audienceMarketStrategy: this.cloneAudienceMarketStrategy(allocation.audienceMarketStrategy),
      channels: [...allocation.channels],
      markets: allocation.markets.map((market) => ({ ...market })),
      channelAllocations: allocation.channelAllocations.map((channel) => ({ ...channel })),
      creativeMix: allocation.creativeMix.map((creative) => ({ ...creative })),
      metadata: { ...allocation.metadata },
    };
  }
}
