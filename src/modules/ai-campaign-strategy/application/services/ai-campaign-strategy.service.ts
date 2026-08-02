import { createHash } from "node:crypto";

import type { CreateCampaignStrategyRequest } from "../dto/create-campaign-strategy.request.js";
import {
  InvalidAudienceError,
  InvalidCampaignRequestError,
  InvalidOfferError,
  InvalidProductContextError,
  InvalidTimestampError,
  MalformedCampaignStrategyError,
  UnsupportedAngleError,
  UnsupportedChannelError,
  UnsupportedObjectiveError,
} from "../../domain/errors/campaign-strategy.errors.js";
import {
  CAMPAIGN_AWARENESS_LEVELS,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_FUNNEL_STAGES,
  CAMPAIGN_MESSAGING_ANGLE_TYPES,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_OFFER_TYPES,
  type AiCampaignStrategy,
  type CampaignAudienceProfile,
  type CampaignChannel,
  type CampaignChannelRole,
  type CampaignChannelStrategy,
  type CampaignFunnelStage,
  type CampaignMessagingAngle,
  type CampaignMessagingAngleType,
  type CampaignObjective,
  type CampaignOfferStrategy,
  type ProductCampaignContext,
} from "../../domain/models/campaign-strategy.model.js";

const STRATEGY_VERSION = "SACP-04.04A";
const POLICY_REVIEW_PATTERN = /\b(health|healthy|medical|medicine|skin|beauty|body|weight|pain|cure|treat|healing|anti-aging)\b/iu;

const OBJECTIVE_FUNNEL_STAGES: Record<CampaignObjective, readonly CampaignFunnelStage[]> = {
  BRAND_AWARENESS: ["AWARENESS"],
  PRODUCT_LAUNCH: ["AWARENESS", "CONSIDERATION"],
  TRAFFIC: ["AWARENESS", "CONSIDERATION"],
  LEAD_GENERATION: ["CONSIDERATION", "CONVERSION"],
  CONVERSION: ["CONSIDERATION", "CONVERSION"],
  RETARGETING: ["CONSIDERATION", "CONVERSION"],
  CUSTOMER_RETENTION: ["RETENTION"],
  UPSELL: ["RETENTION", "CONVERSION"],
  CROSS_SELL: ["RETENTION", "CONVERSION"],
};

const DEFAULT_ANGLES: Record<CampaignObjective, readonly CampaignMessagingAngleType[]> = {
  BRAND_AWARENESS: ["EDUCATION", "LIFESTYLE", "SOCIAL_PROOF"],
  PRODUCT_LAUNCH: ["TRANSFORMATION", "EDUCATION", "SOCIAL_PROOF"],
  TRAFFIC: ["PROBLEM_SOLUTION", "EDUCATION", "LIFESTYLE"],
  LEAD_GENERATION: ["PROBLEM_SOLUTION", "EDUCATION", "AUTHORITY"],
  CONVERSION: ["PROBLEM_SOLUTION", "CONVENIENCE", "URGENCY"],
  RETARGETING: ["SOCIAL_PROOF", "COMPARISON", "URGENCY"],
  CUSTOMER_RETENTION: ["LIFESTYLE", "EDUCATION", "CONVENIENCE"],
  UPSELL: ["TRANSFORMATION", "CONVENIENCE", "COMPARISON"],
  CROSS_SELL: ["LIFESTYLE", "CONVENIENCE", "EDUCATION"],
};

const DEFAULT_CHANNELS: Record<CampaignObjective, readonly { readonly channel: CampaignChannel; readonly role: CampaignChannelRole }[]> = {
  BRAND_AWARENESS: [
    { channel: "TIKTOK", role: "PRIMARY" },
    { channel: "INSTAGRAM", role: "PRIMARY" },
    { channel: "FACEBOOK", role: "SUPPORTING" },
  ],
  PRODUCT_LAUNCH: [
    { channel: "TIKTOK", role: "PRIMARY" },
    { channel: "INSTAGRAM", role: "SUPPORTING" },
    { channel: "FACEBOOK", role: "SUPPORTING" },
    { channel: "EMAIL", role: "SUPPORTING" },
    { channel: "SHOPIFY_ONSITE", role: "SUPPORTING" },
  ],
  TRAFFIC: [
    { channel: "TIKTOK", role: "PRIMARY" },
    { channel: "INSTAGRAM", role: "SUPPORTING" },
    { channel: "SHOPIFY_ONSITE", role: "SUPPORTING" },
  ],
  LEAD_GENERATION: [
    { channel: "FACEBOOK", role: "PRIMARY" },
    { channel: "INSTAGRAM", role: "SUPPORTING" },
    { channel: "EMAIL", role: "SUPPORTING" },
  ],
  CONVERSION: [
    { channel: "TIKTOK", role: "PRIMARY" },
    { channel: "FACEBOOK", role: "PRIMARY" },
    { channel: "SHOPIFY_ONSITE", role: "PRIMARY" },
    { channel: "EMAIL", role: "SUPPORTING" },
    { channel: "RETARGETING", role: "RETARGETING" },
  ],
  RETARGETING: [
    { channel: "FACEBOOK", role: "RETARGETING" },
    { channel: "INSTAGRAM", role: "RETARGETING" },
    { channel: "EMAIL", role: "SUPPORTING" },
    { channel: "SHOPIFY_ONSITE", role: "SUPPORTING" },
  ],
  CUSTOMER_RETENTION: [
    { channel: "EMAIL", role: "PRIMARY" },
    { channel: "SHOPIFY_ONSITE", role: "SUPPORTING" },
    { channel: "INSTAGRAM", role: "SUPPORTING" },
  ],
  UPSELL: [
    { channel: "EMAIL", role: "PRIMARY" },
    { channel: "SHOPIFY_ONSITE", role: "PRIMARY" },
    { channel: "RETARGETING", role: "RETARGETING" },
  ],
  CROSS_SELL: [
    { channel: "EMAIL", role: "PRIMARY" },
    { channel: "SHOPIFY_ONSITE", role: "PRIMARY" },
    { channel: "FACEBOOK", role: "SUPPORTING" },
  ],
};

export class AiCampaignStrategyService {
  public createStrategy(request: CreateCampaignStrategyRequest): AiCampaignStrategy {
    const normalizedRequest = this.validateRequest(request);
    const funnelStages = this.deriveFunnelStages(normalizedRequest.objective);
    const messagingAngles = this.resolveMessagingAngles(normalizedRequest, funnelStages);
    const channels = this.resolveChannelStrategies(normalizedRequest, funnelStages);
    const contentPillars = this.generateContentPillars(normalizedRequest, messagingAngles, funnelStages);
    const warnings = this.generateWarnings(normalizedRequest);
    const risks = this.generateRisks(normalizedRequest);
    const id = this.generateStrategyId(normalizedRequest);

    const strategy: AiCampaignStrategy = {
      id,
      product: this.cloneProduct(normalizedRequest.product),
      objective: normalizedRequest.objective,
      funnelStages: [...funnelStages],
      audience: this.cloneAudience(normalizedRequest.audience),
      offer: this.cloneOffer(normalizedRequest.offer),
      messagingAngles,
      channels,
      contentPillars,
      risks,
      warnings,
      status: "REVIEW_REQUIRED",
      strategyVersion: STRATEGY_VERSION,
      createdAt: normalizedRequest.createdAt,
    };

    this.assertStrategy(strategy);
    return this.cloneStrategy(strategy);
  }

  public deriveFunnelStages(objective: CampaignObjective): readonly CampaignFunnelStage[] {
    if (!this.isSupportedObjective(objective)) {
      throw new UnsupportedObjectiveError("Campaign objective is not supported.", { objective });
    }

    return [...OBJECTIVE_FUNNEL_STAGES[objective]];
  }

  private validateRequest(request: CreateCampaignStrategyRequest): CreateCampaignStrategyRequest {
    if (request === null || typeof request !== "object") {
      throw new InvalidCampaignRequestError();
    }

    const objective = this.validateObjective(request.objective);
    const createdAt = this.normalizeTimestamp(request.createdAt);

    return {
      product: this.validateProduct(request.product),
      objective,
      audience: this.validateAudience(request.audience),
      offer: this.validateOffer(request.offer),
      ...(request.preferredAngles === undefined ? {} : { preferredAngles: this.validatePreferredAngles(request.preferredAngles) }),
      ...(request.preferredChannels === undefined ? {} : { preferredChannels: this.validatePreferredChannels(request.preferredChannels) }),
      createdAt,
    };
  }

  private validateProduct(product: ProductCampaignContext): ProductCampaignContext {
    this.assertObject(product, InvalidProductContextError);
    const productId = this.normalizeRequiredString(product.productId, "productId", InvalidProductContextError);
    const productName = this.normalizeRequiredString(product.productName, "productName", InvalidProductContextError);
    const category = this.normalizeRequiredString(product.category, "category", InvalidProductContextError);
    const keyBenefits = this.normalizeCollection(product.keyBenefits, "keyBenefits", InvalidProductContextError, true);
    const differentiators = this.normalizeCollection(product.differentiators, "differentiators", InvalidProductContextError, false);
    const knownRisks = this.normalizeCollection(product.knownRisks, "knownRisks", InvalidProductContextError, false);
    const markets = this.normalizeCollection(product.markets, "markets", InvalidProductContextError, true);
    const description = this.normalizeOptionalString(product.description, "description", InvalidProductContextError);
    const currency = this.normalizeOptionalCurrency(product.currency);

    if (product.targetPrice !== undefined && (!Number.isFinite(product.targetPrice) || product.targetPrice <= 0)) {
      throw new InvalidProductContextError("Product target price must be finite and greater than zero.", { targetPrice: product.targetPrice });
    }

    return {
      productId,
      productName,
      category,
      ...(description === undefined ? {} : { description }),
      keyBenefits,
      differentiators,
      knownRisks,
      ...(product.targetPrice === undefined ? {} : { targetPrice: this.roundMoney(product.targetPrice) }),
      ...(currency === undefined ? {} : { currency }),
      markets,
    };
  }

  private validateAudience(audience: CampaignAudienceProfile): CampaignAudienceProfile {
    this.assertObject(audience, InvalidAudienceError);
    const id = this.normalizeRequiredString(audience.id, "id", InvalidAudienceError);
    const name = this.normalizeRequiredString(audience.name, "name", InvalidAudienceError);
    const targetMarkets = this.normalizeCollection(audience.targetMarkets, "targetMarkets", InvalidAudienceError, true);
    const interests = this.normalizeCollection(audience.interests, "interests", InvalidAudienceError, false);
    const painPoints = this.normalizeCollection(audience.painPoints, "painPoints", InvalidAudienceError, false);
    const desiredOutcomes = this.normalizeCollection(audience.desiredOutcomes, "desiredOutcomes", InvalidAudienceError, false);
    const objections = this.normalizeCollection(audience.objections, "objections", InvalidAudienceError, false);
    const buyingTriggers = this.normalizeCollection(audience.buyingTriggers, "buyingTriggers", InvalidAudienceError, false);

    if (!this.isCampaignAwarenessLevel(audience.awarenessLevel)) {
      throw new InvalidAudienceError("Audience awareness level is not supported.", { awarenessLevel: audience.awarenessLevel });
    }

    const ageRange = audience.ageRange;
    if (ageRange !== undefined) {
      if (
        !Number.isInteger(ageRange.minimum) ||
        !Number.isInteger(ageRange.maximum) ||
        ageRange.minimum < 0 ||
        ageRange.maximum > 120 ||
        ageRange.minimum > ageRange.maximum
      ) {
        throw new InvalidAudienceError("Audience age range is invalid.", { ageRange });
      }
    }

    return {
      id,
      name,
      targetMarkets,
      ...(ageRange === undefined ? {} : { ageRange: { minimum: ageRange.minimum, maximum: ageRange.maximum } }),
      interests,
      painPoints,
      desiredOutcomes,
      objections,
      buyingTriggers,
      awarenessLevel: audience.awarenessLevel,
    };
  }

  private validateOffer(offer: CampaignOfferStrategy): CampaignOfferStrategy {
    this.assertObject(offer, InvalidOfferError);

    if (!this.isCampaignOfferType(offer.type)) {
      throw new InvalidOfferError("Campaign offer type is not supported.", { type: offer.type });
    }

    const headline = this.normalizeRequiredString(offer.headline, "headline", InvalidOfferError);
    const description = this.normalizeOptionalString(offer.description, "description", InvalidOfferError);
    const terms = this.normalizeCollection(offer.terms, "terms", InvalidOfferError, false);
    const currency = this.normalizeOptionalCurrency(offer.currency);
    const expiresAt = offer.expiresAt === undefined ? undefined : this.normalizeTimestamp(offer.expiresAt);

    if (offer.discountPercentage !== undefined && (!Number.isFinite(offer.discountPercentage) || offer.discountPercentage <= 0 || offer.discountPercentage > 90)) {
      throw new InvalidOfferError("Discount percentage must be greater than zero and no more than 90.", { discountPercentage: offer.discountPercentage });
    }

    if (offer.discountAmount !== undefined && (!Number.isFinite(offer.discountAmount) || offer.discountAmount <= 0)) {
      throw new InvalidOfferError("Discount amount must be finite and greater than zero.", { discountAmount: offer.discountAmount });
    }

    if (offer.minimumQuantity !== undefined && (!Number.isInteger(offer.minimumQuantity) || offer.minimumQuantity < 2)) {
      throw new InvalidOfferError("Minimum quantity must be an integer greater than one.", { minimumQuantity: offer.minimumQuantity });
    }

    if (offer.type === "PERCENTAGE_DISCOUNT" && offer.discountPercentage === undefined) {
      throw new InvalidOfferError("Percentage discount offers require discountPercentage.");
    }

    if (offer.type === "FIXED_DISCOUNT" && (offer.discountAmount === undefined || currency === undefined)) {
      throw new InvalidOfferError("Fixed discount offers require discountAmount and currency.");
    }

    if (offer.type === "BUY_MORE_SAVE_MORE" && offer.minimumQuantity === undefined) {
      throw new InvalidOfferError("Buy more save more offers require minimumQuantity.");
    }

    return {
      type: offer.type,
      headline,
      ...(description === undefined ? {} : { description }),
      ...(offer.discountPercentage === undefined ? {} : { discountPercentage: this.roundMoney(offer.discountPercentage) }),
      ...(offer.discountAmount === undefined ? {} : { discountAmount: this.roundMoney(offer.discountAmount) }),
      ...(currency === undefined ? {} : { currency }),
      ...(offer.minimumQuantity === undefined ? {} : { minimumQuantity: offer.minimumQuantity }),
      ...(expiresAt === undefined ? {} : { expiresAt }),
      terms,
    };
  }

  private resolveMessagingAngles(
    request: CreateCampaignStrategyRequest,
    funnelStages: readonly CampaignFunnelStage[],
  ): readonly CampaignMessagingAngle[] {
    const orderedTypes = this.uniqueOrdered([...(request.preferredAngles ?? []), ...DEFAULT_ANGLES[request.objective]]);
    return orderedTypes.map((type) => this.buildMessagingAngle(type, request, funnelStages));
  }

  private buildMessagingAngle(
    type: CampaignMessagingAngleType,
    request: CreateCampaignStrategyRequest,
    funnelStages: readonly CampaignFunnelStage[],
  ): CampaignMessagingAngle {
    const productName = request.product.productName;
    const firstBenefit = request.product.keyBenefits[0] ?? "the product benefits";
    const firstPainPoint = request.audience.painPoints[0] ?? "customer friction";

    return {
      type,
      headline: `${this.toTitleCase(type)} for ${productName}`,
      coreMessage: `${productName} connects ${firstBenefit} to ${firstPainPoint} across ${funnelStages.join(", ")}.`,
      supportingPoints: this.uniqueOrdered([
        ...request.product.keyBenefits.slice(0, 2),
        ...request.audience.desiredOutcomes.slice(0, 2),
        ...request.product.differentiators.slice(0, 1),
      ]),
      prohibitedClaims: ["medical cure claims", "guaranteed income claims", "unverified comparative claims"],
    };
  }

  private resolveChannelStrategies(
    request: CreateCampaignStrategyRequest,
    funnelStages: readonly CampaignFunnelStage[],
  ): readonly CampaignChannelStrategy[] {
    const defaults = DEFAULT_CHANNELS[request.objective];
    const filteredDefaults =
      request.preferredChannels === undefined
        ? defaults
        : request.preferredChannels
            .map((channel) => defaults.find((entry) => entry.channel === channel) ?? { channel, role: this.defaultRoleForChannel(channel) })
            .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.channel === entry.channel) === index);

    return filteredDefaults.map((entry) => ({
      channel: entry.channel,
      role: entry.role,
      funnelStages: [...funnelStages],
      contentFormats: this.contentFormatsFor(entry.channel),
      primaryCta: this.primaryCtaFor(request.objective),
      notes: [`${entry.channel} is scoped for ${entry.role.toLowerCase()} campaign support.`, "Human review remains required before execution."],
    }));
  }

  private generateContentPillars(
    request: CreateCampaignStrategyRequest,
    messagingAngles: readonly CampaignMessagingAngle[],
    funnelStages: readonly CampaignFunnelStage[],
  ): readonly string[] {
    const dynamicPillars = [
      ...request.product.keyBenefits.map((benefit) => `Benefit: ${benefit}`),
      ...request.audience.painPoints.map((painPoint) => `Pain Point: ${painPoint}`),
      ...request.audience.desiredOutcomes.map((outcome) => `Outcome: ${outcome}`),
      ...messagingAngles.map((angle) => this.toTitleCase(angle.type)),
      ...funnelStages.map((stage) => this.toTitleCase(stage)),
    ];

    return this.uniqueOrdered([
      "Problem Education",
      "Product Demonstration",
      "Benefit Transformation",
      "Objection Handling",
      "Social Proof",
      "Offer and Urgency",
      "Product Usage",
      "Brand Trust",
      ...dynamicPillars,
    ]);
  }

  private generateWarnings(request: CreateCampaignStrategyRequest): readonly string[] {
    const warnings: string[] = [];

    if (request.product.description === undefined) {
      warnings.push("Product description is missing and should be reviewed before campaign execution.");
    }

    if (request.product.targetPrice === undefined) {
      warnings.push("Target price is missing; commercial validation is required before approving campaign offers.");
    }

    if (request.product.currency === undefined) {
      warnings.push("Currency is missing; commercial validation is required before approving campaign offers.");
    }

    if (request.product.knownRisks.length === 0) {
      warnings.push("No known product risks were supplied for campaign review.");
    }

    if (request.audience.targetMarkets.length >= 5 || request.audience.interests.length === 0) {
      warnings.push("Audience profile is broad and may need segmentation before execution.");
    }

    if (this.hasConflictingMarkets(request.product.markets, request.audience.targetMarkets)) {
      warnings.push("Product markets and audience target markets do not overlap and require review.");
    }

    if (["PERCENTAGE_DISCOUNT", "FIXED_DISCOUNT", "BUY_MORE_SAVE_MORE"].includes(request.offer.type)) {
      warnings.push("Discount offer requires separate commercial validation before approval.");
    }

    if (["LIMITED_TIME"].includes(request.offer.type) && request.offer.expiresAt === undefined) {
      warnings.push("Urgency offer has no expiry timestamp and requires review.");
    }

    if (request.offer.type === "GUARANTEE" && request.offer.terms.length === 0) {
      warnings.push("Guarantee offer has no terms and requires review.");
    }

    if (this.requiresPolicyReview(request)) {
      warnings.push("Health, beauty, or body-related claims require policy review.");
    }

    return this.uniqueOrdered(warnings);
  }

  private generateRisks(request: CreateCampaignStrategyRequest): readonly string[] {
    return this.uniqueOrdered([
      ...request.product.knownRisks,
      ...request.audience.objections.map((objection) => `Audience objection: ${objection}`),
      "Campaign execution is blocked until merchant review is complete.",
    ]);
  }

  private generateStrategyId(request: CreateCampaignStrategyRequest): string {
    const hash = createHash("sha256")
      .update([request.product.productId, request.objective, request.audience.id, STRATEGY_VERSION, request.createdAt].join("|"))
      .digest("hex")
      .slice(0, 24);

    return `ai-campaign-strategy:${hash}`;
  }

  private assertStrategy(strategy: AiCampaignStrategy): void {
    if (strategy.status === "MERCHANT_APPROVED") {
      throw new MalformedCampaignStrategyError("Campaign strategy cannot be merchant approved by default.", { id: strategy.id });
    }

    if (!strategy.id.startsWith("ai-campaign-strategy:")) {
      throw new MalformedCampaignStrategyError("Campaign strategy ID is malformed.", { id: strategy.id });
    }

    for (const stage of strategy.funnelStages) {
      if (!CAMPAIGN_FUNNEL_STAGES.includes(stage)) {
        throw new MalformedCampaignStrategyError("Campaign strategy includes an invalid funnel stage.", { stage });
      }
    }
  }

  private validateObjective(objective: CampaignObjective): CampaignObjective {
    if (!this.isSupportedObjective(objective)) {
      throw new UnsupportedObjectiveError("Campaign objective is not supported.", { objective });
    }

    return objective;
  }

  private validatePreferredAngles(angles: unknown): readonly CampaignMessagingAngleType[] {
    if (!Array.isArray(angles)) {
      throw new UnsupportedAngleError("Preferred angles must be an array.");
    }

    const supportedAngles: CampaignMessagingAngleType[] = [];
    for (const angle of angles) {
      if (typeof angle !== "string" || !CAMPAIGN_MESSAGING_ANGLE_TYPES.includes(angle as CampaignMessagingAngleType)) {
        throw new UnsupportedAngleError("Preferred angle is not supported.", { angle });
      }

      supportedAngles.push(angle as CampaignMessagingAngleType);
    }

    return this.uniqueOrdered(supportedAngles);
  }

  private validatePreferredChannels(channels: unknown): readonly CampaignChannel[] {
    if (!Array.isArray(channels)) {
      throw new UnsupportedChannelError("Preferred channels must be an array.");
    }

    const supportedChannels: CampaignChannel[] = [];
    for (const channel of channels) {
      if (typeof channel !== "string" || !CAMPAIGN_CHANNELS.includes(channel as CampaignChannel)) {
        throw new UnsupportedChannelError("Preferred channel is not supported.", { channel });
      }

      supportedChannels.push(channel as CampaignChannel);
    }

    return this.uniqueOrdered(supportedChannels);
  }

  private assertObject<TError extends new (message?: string, details?: Record<string, unknown>) => Error>(
    value: unknown,
    ErrorClass: TError,
  ): void {
    if (value === null || typeof value !== "object") {
      throw new ErrorClass("Expected an object.");
    }
  }

  private normalizeRequiredString<TError extends new (message?: string, details?: Record<string, unknown>) => Error>(
    value: unknown,
    field: string,
    ErrorClass: TError,
  ): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ErrorClass(`${field} cannot be blank.`, { field });
    }

    return value.trim();
  }

  private normalizeOptionalString<TError extends new (message?: string, details?: Record<string, unknown>) => Error>(
    value: unknown,
    field: string,
    ErrorClass: TError,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    return this.normalizeRequiredString(value, field, ErrorClass);
  }

  private normalizeCollection<TError extends new (message?: string, details?: Record<string, unknown>) => Error>(
    value: unknown,
    field: string,
    ErrorClass: TError,
    requireOne: boolean,
  ): readonly string[] {
    if (!Array.isArray(value)) {
      throw new ErrorClass(`${field} must be an array.`, { field });
    }

    const normalized = this.uniqueOrdered(
      value.map((item) => {
        if (typeof item !== "string" || item.trim().length === 0) {
          throw new ErrorClass(`${field} cannot include blank values.`, { field });
        }

        return item.trim();
      }),
    );

    if (requireOne && normalized.length === 0) {
      throw new ErrorClass(`${field} must include at least one value.`, { field });
    }

    return normalized;
  }

  private normalizeOptionalCurrency(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string" || !/^[A-Za-z]{3}$/u.test(value.trim())) {
      throw new InvalidCampaignRequestError("Currency must be a three-letter code.", { currency: value });
    }

    return value.trim().toUpperCase();
  }

  private normalizeTimestamp(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new InvalidTimestampError("Timestamp cannot be blank.");
    }

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value.trim()) {
      throw new InvalidTimestampError("Timestamp must be a valid ISO-8601 UTC timestamp.", { timestamp: value });
    }

    return value.trim();
  }

  private hasConflictingMarkets(productMarkets: readonly string[], audienceMarkets: readonly string[]): boolean {
    const productMarketSet = new Set(productMarkets.map((market) => market.toUpperCase()));
    return audienceMarkets.every((market) => !productMarketSet.has(market.toUpperCase()));
  }

  private requiresPolicyReview(request: CreateCampaignStrategyRequest): boolean {
    const claimText = [
      request.product.productName,
      request.product.category,
      request.product.description ?? "",
      ...request.product.keyBenefits,
      ...request.product.differentiators,
      ...request.audience.painPoints,
      ...request.audience.desiredOutcomes,
      request.offer.headline,
      request.offer.description ?? "",
    ].join(" ");

    return POLICY_REVIEW_PATTERN.test(claimText);
  }

  private contentFormatsFor(channel: CampaignChannel): readonly string[] {
    const formats: Record<CampaignChannel, readonly string[]> = {
      TIKTOK: ["short video", "creator hook", "product demo"],
      FACEBOOK: ["feed post", "carousel", "retargeting creative"],
      INSTAGRAM: ["reel", "story", "carousel"],
      EMAIL: ["campaign email", "offer reminder", "education sequence"],
      SHOPIFY_ONSITE: ["homepage banner", "product page block", "cart callout"],
      RETARGETING: ["dynamic ad", "abandoned cart reminder", "objection handler"],
    };

    return [...formats[channel]];
  }

  private primaryCtaFor(objective: CampaignObjective): string {
    const ctas: Record<CampaignObjective, string> = {
      BRAND_AWARENESS: "Learn More",
      PRODUCT_LAUNCH: "Explore the Launch",
      TRAFFIC: "Visit Store",
      LEAD_GENERATION: "Join the List",
      CONVERSION: "Shop Now",
      RETARGETING: "Complete Your Order",
      CUSTOMER_RETENTION: "Come Back Today",
      UPSELL: "Upgrade Now",
      CROSS_SELL: "Complete the Set",
    };

    return ctas[objective];
  }

  private defaultRoleForChannel(channel: CampaignChannel): CampaignChannelRole {
    return channel === "RETARGETING" ? "RETARGETING" : "SUPPORTING";
  }

  private cloneStrategy(strategy: AiCampaignStrategy): AiCampaignStrategy {
    return {
      ...strategy,
      product: this.cloneProduct(strategy.product),
      funnelStages: [...strategy.funnelStages],
      audience: this.cloneAudience(strategy.audience),
      offer: this.cloneOffer(strategy.offer),
      messagingAngles: strategy.messagingAngles.map((angle) => this.cloneAngle(angle)),
      channels: strategy.channels.map((channel) => this.cloneChannel(channel)),
      contentPillars: [...strategy.contentPillars],
      risks: [...strategy.risks],
      warnings: [...strategy.warnings],
    };
  }

  private cloneProduct(product: ProductCampaignContext): ProductCampaignContext {
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

  private cloneAudience(audience: CampaignAudienceProfile): CampaignAudienceProfile {
    return {
      id: audience.id,
      name: audience.name,
      targetMarkets: [...audience.targetMarkets],
      ...(audience.ageRange === undefined ? {} : { ageRange: { ...audience.ageRange } }),
      interests: [...audience.interests],
      painPoints: [...audience.painPoints],
      desiredOutcomes: [...audience.desiredOutcomes],
      objections: [...audience.objections],
      buyingTriggers: [...audience.buyingTriggers],
      awarenessLevel: audience.awarenessLevel,
    };
  }

  private cloneOffer(offer: CampaignOfferStrategy): CampaignOfferStrategy {
    return {
      type: offer.type,
      headline: offer.headline,
      ...(offer.description === undefined ? {} : { description: offer.description }),
      ...(offer.discountPercentage === undefined ? {} : { discountPercentage: offer.discountPercentage }),
      ...(offer.discountAmount === undefined ? {} : { discountAmount: offer.discountAmount }),
      ...(offer.currency === undefined ? {} : { currency: offer.currency }),
      ...(offer.minimumQuantity === undefined ? {} : { minimumQuantity: offer.minimumQuantity }),
      ...(offer.expiresAt === undefined ? {} : { expiresAt: offer.expiresAt }),
      terms: [...offer.terms],
    };
  }

  private cloneAngle(angle: CampaignMessagingAngle): CampaignMessagingAngle {
    return {
      type: angle.type,
      headline: angle.headline,
      coreMessage: angle.coreMessage,
      supportingPoints: [...angle.supportingPoints],
      prohibitedClaims: [...angle.prohibitedClaims],
    };
  }

  private cloneChannel(channel: CampaignChannelStrategy): CampaignChannelStrategy {
    return {
      channel: channel.channel,
      role: channel.role,
      funnelStages: [...channel.funnelStages],
      contentFormats: [...channel.contentFormats],
      primaryCta: channel.primaryCta,
      notes: [...channel.notes],
    };
  }

  private isSupportedObjective(objective: string): objective is CampaignObjective {
    return CAMPAIGN_OBJECTIVES.includes(objective as CampaignObjective);
  }

  private isCampaignOfferType(type: string): type is CampaignOfferStrategy["type"] {
    return CAMPAIGN_OFFER_TYPES.includes(type as CampaignOfferStrategy["type"]);
  }

  private isCampaignAwarenessLevel(level: string): level is CampaignAudienceProfile["awarenessLevel"] {
    return CAMPAIGN_AWARENESS_LEVELS.includes(level as CampaignAudienceProfile["awarenessLevel"]);
  }

  private uniqueOrdered<TValue extends string>(values: readonly TValue[]): readonly TValue[] {
    const seen = new Set<string>();
    const output: TValue[] = [];

    for (const value of values) {
      const key = value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        output.push(value);
      }
    }

    return output;
  }

  private toTitleCase(value: string): string {
    return value
      .toLowerCase()
      .split("_")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
