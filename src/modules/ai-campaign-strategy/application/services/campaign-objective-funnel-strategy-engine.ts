import type { CreateCampaignStrategyRequest } from "../dto/create-campaign-strategy.request.js";
import { AiCampaignStrategyService } from "./ai-campaign-strategy.service.js";
import type {
  AiCampaignStrategy,
  CampaignAwarenessLevel,
  CampaignMessagingAngleType,
  CampaignObjective,
  CampaignOfferType,
} from "../../domain/models/campaign-strategy.model.js";
import {
  CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
  type CampaignIntentLevel,
  type CampaignObjectiveFunnelStrategy,
  type CampaignStrategySignal,
  type CampaignStrategicFunnelStage,
  type CampaignStrategicObjective,
} from "../../domain/models/campaign-objective-funnel-strategy.model.js";

type SignalBucket = "RETENTION" | "CONVERSION" | "CONSIDERATION" | "AWARENESS";

const BUCKET_PRECEDENCE: readonly SignalBucket[] = ["RETENTION", "CONVERSION", "CONSIDERATION", "AWARENESS"];

const RETENTION_OBJECTIVES: readonly CampaignObjective[] = ["CUSTOMER_RETENTION", "UPSELL", "CROSS_SELL"];
const CONVERSION_OBJECTIVES: readonly CampaignObjective[] = ["CONVERSION", "RETARGETING"];
const CONSIDERATION_OBJECTIVES: readonly CampaignObjective[] = ["LEAD_GENERATION"];
const AWARENESS_OBJECTIVES: readonly CampaignObjective[] = ["BRAND_AWARENESS", "PRODUCT_LAUNCH", "TRAFFIC"];

const PURCHASE_OFFER_TYPES: readonly CampaignOfferType[] = [
  "PERCENTAGE_DISCOUNT",
  "FIXED_DISCOUNT",
  "BUNDLE",
  "BUY_MORE_SAVE_MORE",
  "FREE_SHIPPING",
  "FREE_GIFT",
  "LIMITED_TIME",
  "GUARANTEE",
];

const CONSIDERATION_ANGLES: readonly CampaignMessagingAngleType[] = ["EDUCATION", "AUTHORITY", "COMPARISON", "PROBLEM_SOLUTION"];

export class CampaignObjectiveFunnelStrategyEngine {
  private readonly strategyService = new AiCampaignStrategyService();

  public determineStrategy(request: CreateCampaignStrategyRequest): CampaignObjectiveFunnelStrategy {
    return this.determineFromStrategy(this.strategyService.createStrategy(request));
  }

  public determineFromStrategy(strategy: AiCampaignStrategy): CampaignObjectiveFunnelStrategy {
    const signalsByBucket = this.collectSignals(strategy);
    const selectedBucket = BUCKET_PRECEDENCE.find((bucket) => signalsByBucket[bucket].length > 0) ?? "AWARENESS";
    const supportingSignals = signalsByBucket[selectedBucket];

    return {
      campaignStrategyId: strategy.id,
      product: this.cloneProduct(strategy.product),
      channels: strategy.channels.map((channel) => channel.channel),
      markets: this.uniqueOrdered([...strategy.product.markets, ...strategy.audience.targetMarkets]),
      selectedObjective: this.toStrategicObjective(selectedBucket, strategy),
      funnelStage: this.toFunnelStage(selectedBucket),
      intentLevel: this.toIntentLevel(selectedBucket, strategy.audience.awarenessLevel),
      reasoning: this.buildReasoning(selectedBucket, supportingSignals),
      supportingSignals: supportingSignals.map((signal) => ({ ...signal })),
      recommendedCampaignFocus: this.recommendedFocus(selectedBucket),
      recommendedCtaDirection: this.recommendedCtaDirection(selectedBucket),
      advisoryOnly: true,
      metadata: {
        strategyVersion: CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
        sourceStrategyVersion: strategy.strategyVersion,
        precedenceRule: "RETENTION_THEN_CONVERSION_THEN_CONSIDERATION_THEN_AWARENESS",
      },
    };
  }

  private collectSignals(strategy: AiCampaignStrategy): Readonly<Record<SignalBucket, readonly CampaignStrategySignal[]>> {
    return {
      RETENTION: this.retentionSignals(strategy),
      CONVERSION: this.conversionSignals(strategy),
      CONSIDERATION: this.considerationSignals(strategy),
      AWARENESS: this.awarenessSignals(strategy),
    };
  }

  private retentionSignals(strategy: AiCampaignStrategy): readonly CampaignStrategySignal[] {
    const signals: CampaignStrategySignal[] = [];

    if (RETENTION_OBJECTIVES.includes(strategy.objective)) {
      signals.push(this.signal("RETENTION_OBJECTIVE", `${strategy.objective} is an existing-customer or repeat-purchase objective.`, "objective"));
    }

    if (strategy.channels.some((channel) => channel.channel === "EMAIL" && channel.role === "PRIMARY")) {
      signals.push(this.signal("RETENTION_EMAIL_PRIMARY", "Email is the primary channel for customer continuity.", "channels"));
    }

    if (this.containsAny(strategy.audience.buyingTriggers, ["repeat", "renew", "loyal", "reorder", "upgrade"])) {
      signals.push(this.signal("RETENTION_BUYING_TRIGGER", "Audience buying triggers include repeat-purchase language.", "audience.buyingTriggers"));
    }

    return signals;
  }

  private conversionSignals(strategy: AiCampaignStrategy): readonly CampaignStrategySignal[] {
    const signals: CampaignStrategySignal[] = [];

    if (CONVERSION_OBJECTIVES.includes(strategy.objective)) {
      signals.push(this.signal("CONVERSION_OBJECTIVE", `${strategy.objective} is a purchase-intent objective.`, "objective"));
    }

    if (PURCHASE_OFFER_TYPES.includes(strategy.offer.type)) {
      signals.push(this.signal("CONVERSION_OFFER", `${strategy.offer.type} offer indicates purchase-path focus.`, "offer.type"));
    }

    if (strategy.audience.awarenessLevel === "MOST_AWARE") {
      signals.push(this.signal("CONVERSION_MOST_AWARE", "Audience is already most aware.", "audience.awarenessLevel"));
    }

    if (this.containsAny(strategy.audience.buyingTriggers, ["buy", "shop", "cart", "checkout", "limited", "discount"])) {
      signals.push(this.signal("CONVERSION_BUYING_TRIGGER", "Audience buying triggers include purchase language.", "audience.buyingTriggers"));
    }

    return signals;
  }

  private considerationSignals(strategy: AiCampaignStrategy): readonly CampaignStrategySignal[] {
    const signals: CampaignStrategySignal[] = [];

    if (CONSIDERATION_OBJECTIVES.includes(strategy.objective)) {
      signals.push(this.signal("CONSIDERATION_OBJECTIVE", `${strategy.objective} indicates evaluation before conversion.`, "objective"));
    }

    if (strategy.audience.awarenessLevel === "SOLUTION_AWARE" || strategy.audience.awarenessLevel === "PRODUCT_AWARE") {
      signals.push(this.signal("CONSIDERATION_AWARENESS_LEVEL", "Audience has solution or product awareness.", "audience.awarenessLevel"));
    }

    if (this.isConsiderationAware(strategy.audience.awarenessLevel) && strategy.messagingAngles.some((angle) => CONSIDERATION_ANGLES.includes(angle.type))) {
      signals.push(this.signal("CONSIDERATION_MESSAGING_ANGLE", "Messaging includes education, comparison, authority, or problem-solution framing.", "messagingAngles"));
    }

    if (this.isConsiderationAware(strategy.audience.awarenessLevel) && strategy.audience.objections.length > 0) {
      signals.push(this.signal("CONSIDERATION_OBJECTIONS", "Audience objections require evaluation support.", "audience.objections"));
    }

    return signals;
  }

  private awarenessSignals(strategy: AiCampaignStrategy): readonly CampaignStrategySignal[] {
    const signals: CampaignStrategySignal[] = [];

    if (AWARENESS_OBJECTIVES.includes(strategy.objective)) {
      signals.push(this.signal("AWARENESS_OBJECTIVE", `${strategy.objective} is discovery-oriented.`, "objective"));
    }

    if (strategy.audience.awarenessLevel === "UNAWARE" || strategy.audience.awarenessLevel === "PROBLEM_AWARE") {
      signals.push(this.signal("AWARENESS_LEVEL_LOW", "Audience awareness is early-stage.", "audience.awarenessLevel"));
    }

    if (strategy.audience.interests.length > 0) {
      signals.push(this.signal("AWARENESS_INTERESTS", "Audience interests support broad discovery targeting.", "audience.interests"));
    }

    return signals;
  }

  private toStrategicObjective(bucket: SignalBucket, strategy: AiCampaignStrategy): CampaignStrategicObjective {
    if (bucket === "RETENTION") {
      return "RETENTION";
    }

    if (bucket === "CONVERSION") {
      return "CONVERSION";
    }

    if (bucket === "CONSIDERATION") {
      return strategy.objective === "LEAD_GENERATION" ? "LEAD_GENERATION" : "ENGAGEMENT";
    }

    return strategy.objective === "TRAFFIC" ? "TRAFFIC" : "AWARENESS";
  }

  private toFunnelStage(bucket: SignalBucket): CampaignStrategicFunnelStage {
    const stages: Record<SignalBucket, CampaignStrategicFunnelStage> = {
      RETENTION: "RETENTION",
      CONVERSION: "BOFU",
      CONSIDERATION: "MOFU",
      AWARENESS: "TOFU",
    };

    return stages[bucket];
  }

  private toIntentLevel(bucket: SignalBucket, awarenessLevel: CampaignAwarenessLevel): CampaignIntentLevel {
    if (bucket === "RETENTION" || bucket === "CONVERSION") {
      return "HIGH";
    }

    if (bucket === "CONSIDERATION" || awarenessLevel === "PRODUCT_AWARE") {
      return "MEDIUM";
    }

    return "LOW";
  }

  private buildReasoning(bucket: SignalBucket, signals: readonly CampaignStrategySignal[]): readonly string[] {
    return [
      `Selected ${bucket} because it is the highest-precedence matching signal group.`,
      "Precedence is RETENTION, then CONVERSION, then CONSIDERATION, then AWARENESS.",
      ...signals.map((signal) => signal.message),
    ];
  }

  private recommendedFocus(bucket: SignalBucket): string {
    const focus: Record<SignalBucket, string> = {
      RETENTION: "Strengthen repeat-purchase value, loyalty context, and customer reactivation paths.",
      CONVERSION: "Focus on purchase readiness, offer clarity, objection handling, and direct response alignment.",
      CONSIDERATION: "Build evaluation confidence through education, proof points, comparisons, and objection handling.",
      AWARENESS: "Build discovery, category education, and memorable product positioning for early-stage audiences.",
    };

    return focus[bucket];
  }

  private recommendedCtaDirection(bucket: SignalBucket): string {
    const cta: Record<SignalBucket, string> = {
      RETENTION: "Use return, reorder, renew, or loyalty-oriented CTA direction.",
      CONVERSION: "Use direct purchase or checkout-oriented CTA direction.",
      CONSIDERATION: "Use learn, compare, join, or evaluate-oriented CTA direction.",
      AWARENESS: "Use discover, learn more, or explore-oriented CTA direction.",
    };

    return cta[bucket];
  }

  private signal(code: string, message: string, source: string): CampaignStrategySignal {
    return { code, message, source };
  }

  private containsAny(values: readonly string[], needles: readonly string[]): boolean {
    const normalizedValues = values.map((value) => value.toLowerCase());
    return needles.some((needle) => normalizedValues.some((value) => value.includes(needle)));
  }

  private isConsiderationAware(awarenessLevel: CampaignAwarenessLevel): boolean {
    return awarenessLevel === "SOLUTION_AWARE" || awarenessLevel === "PRODUCT_AWARE" || awarenessLevel === "MOST_AWARE";
  }

  private cloneProduct(product: AiCampaignStrategy["product"]): AiCampaignStrategy["product"] {
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

  private uniqueOrdered(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const value of values) {
      const key = value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        output.push(value);
      }
    }

    return output;
  }
}
