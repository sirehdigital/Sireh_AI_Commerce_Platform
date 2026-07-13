import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductMarketingAngle,
  ProductScoreBreakdown,
} from "../types/product.types.js";

export type ProductBrandVoice =
  | "premium"
  | "confident"
  | "friendly"
  | "minimal"
  | "expert"
  | "playful"
  | "practical"
  | "natural"
  | "bold"
  | "trustworthy";

export type ProductPositioningTier = "value" | "mass-market" | "premium" | "luxury" | "specialist";

/** Structured messaging pillar for downstream copy and marketing workflows. */
export interface ProductMessagingPillar {
  readonly title: string;
  readonly message: string;
  readonly supportingPoints: readonly string[];
}

/** Naming direction guidance for future brand and campaign exploration. */
export interface ProductNamingDirection {
  readonly direction: string;
  readonly rationale: string;
  readonly exampleNames: readonly string[];
}

/** Deterministic product branding output generated from normalized product intelligence. */
export interface ProductBrandingResult {
  readonly brandedTitle: string;
  readonly positioningStatement: string;
  readonly uniqueSellingProposition: string;
  readonly customerTransformation: string;
  readonly primaryAudience: string;
  readonly brandVoice: ProductBrandVoice;
  readonly positioningTier: ProductPositioningTier;
  readonly corePromise: string;
  readonly differentiationPoints: readonly string[];
  readonly messagingPillars: readonly ProductMessagingPillar[];
  readonly namingDirections: readonly ProductNamingDirection[];
  readonly taglineOptions: readonly string[];
  readonly approvedClaims: readonly string[];
  readonly avoidedClaims: readonly string[];
  readonly confidenceScore: number;
  readonly reasoning: readonly string[];
}

const WEAK_PLACEHOLDERS = new Set([
  "unbranded",
  "uncategorized",
  "untitled product",
  "product",
  "item",
  "new product",
]);

const UNSAFE_CLAIM_TERMS = [
  "guaranteed",
  "cure",
  "cures",
  "treats disease",
  "clinically proven",
  "number one",
  "best in the world",
  "risk-free",
  "instant results",
  "permanent results",
  "viral",
  "trending",
  "fda approved",
  "doctor approved",
] as const;

/**
 * Builds deterministic, rule-based branding direction from product and analysis data.
 */
export class ProductBrandingService {
  /**
   * Produces a structured branding result without external AI, API, database, or live-market input.
   */
  public buildBranding(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): ProductBrandingResult {
    const primaryAudience = this.resolvePrimaryAudience(product, analysis);
    const positioningTier = this.resolvePositioningTier(product, analysis.score);
    const brandVoice = this.resolveBrandVoice(product, analysis, positioningTier);
    const brandedTitle = this.buildBrandedTitle(product);

    return {
      brandedTitle,
      positioningStatement: this.buildPositioningStatement(
        product,
        analysis,
        brandedTitle,
        primaryAudience,
      ),
      uniqueSellingProposition: this.buildUniqueSellingProposition(product, analysis),
      customerTransformation: this.buildCustomerTransformation(product, analysis),
      primaryAudience,
      brandVoice,
      positioningTier,
      corePromise: this.buildCorePromise(product, analysis),
      differentiationPoints: this.buildDifferentiationPoints(product, analysis),
      messagingPillars: this.buildMessagingPillars(product, analysis),
      namingDirections: this.buildNamingDirections(product, brandedTitle, positioningTier),
      taglineOptions: this.buildTaglineOptions(product, analysis),
      approvedClaims: this.buildApprovedClaims(product, analysis),
      avoidedClaims: this.buildAvoidedClaims(analysis),
      confidenceScore: this.calculateConfidenceScore(product, analysis),
      reasoning: this.buildReasoning(product, analysis, brandVoice, positioningTier),
    };
  }

  private buildBrandedTitle(product: NormalizedProduct): string {
    const title = this.removeTitleClutter(product.title);
    const productType = this.safeProductType(product);
    const brand = this.isMeaningfulValue(product.brand) ? this.normalizeText(product.brand) : "";
    const titleParts = this.uniqueWords(title).slice(0, 9);
    const conciseTitle = titleParts.join(" ");

    if (conciseTitle.split(" ").length >= 3 && !this.isWeakValue(conciseTitle)) {
      return brand.length > 0 && !this.includesCaseInsensitive(conciseTitle, brand)
        ? `${brand} ${conciseTitle}`.split(" ").slice(0, 9).join(" ")
        : conciseTitle;
    }

    return `Premium ${productType}`.split(" ").slice(0, 9).join(" ");
  }

  private buildPositioningStatement(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    brandedTitle: string,
    primaryAudience: string,
  ): string {
    const outcome = this.firstSafeText(analysis.audience.customerDesires, "a simpler buying decision");
    const differentiator = this.firstSafeText(
      this.buildDifferentiationPoints(product, analysis),
      "clear product information",
    );

    return this.sanitizeClaim(
      `For ${primaryAudience} who want ${outcome.toLowerCase()}, ${brandedTitle} offers ${this.coreBenefit(analysis).toLowerCase()} through ${differentiator.toLowerCase()}.`,
    );
  }

  private buildUniqueSellingProposition(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): string {
    if (product.variants.length > 1) {
      return "A flexible product option set supported by clear variant choices.";
    }

    if (product.images.length >= 3) {
      return "A visually ready product presentation suited for ecommerce testing.";
    }

    if (analysis.score.profitability >= 75) {
      return "A commercially promising product with supportive pricing signals.";
    }

    return this.sanitizeClaim(`${this.safeProductType(product)} positioning built around ${this.coreBenefit(analysis).toLowerCase()}.`);
  }

  private buildCustomerTransformation(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): string {
    const text = this.searchableText(product, analysis);

    if (this.includesAny(text, ["beauty", "skincare", "fashion", "style"])) {
      return "Feels more confident with a more polished daily routine.";
    }

    if (this.includesAny(text, ["home", "kitchen", "organizer", "storage"])) {
      return "Keeps everyday essentials more organized with less friction.";
    }

    if (this.includesAny(text, ["fitness", "travel", "tool", "tech"])) {
      return "Feels prepared and in control with a practical product choice.";
    }

    return "Enjoys a simpler, more confident product experience.";
  }

  private resolvePrimaryAudience(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): string {
    const audience = this.normalizeText(analysis.audience.primaryAudience);

    if (audience.length > 0) {
      return audience;
    }

    const text = this.searchableText(product, analysis);

    if (this.includesAny(text, ["beauty", "skincare", "makeup"])) {
      return "Beauty enthusiasts";
    }

    if (this.includesAny(text, ["pet", "dog", "cat"])) {
      return "Pet owners";
    }

    if (this.includesAny(text, ["home", "kitchen", "decor"])) {
      return "Home owners";
    }

    if (this.includesAny(text, ["fitness", "gym", "sport"])) {
      return "Fitness consumers";
    }

    return product.targetMarkets.length > 0 ? "Online shoppers in selected markets" : "General online shoppers";
  }

  private resolveBrandVoice(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    tier: ProductPositioningTier,
  ): ProductBrandVoice {
    const text = this.searchableText(product, analysis);

    if (tier === "luxury" || tier === "premium") {
      return this.includesAny(text, ["natural", "organic", "skincare"]) ? "natural" : "premium";
    }

    if (tier === "specialist") {
      return "expert";
    }

    if (this.includesAny(text, ["pet", "kids", "baby"])) {
      return "friendly";
    }

    if (this.includesAny(text, ["home", "organizer", "kitchen"])) {
      return "practical";
    }

    if (analysis.risks.level === "low" && analysis.score.overall >= 70) {
      return "confident";
    }

    return "trustworthy";
  }

  private resolvePositioningTier(
    product: NormalizedProduct,
    score: ProductScoreBreakdown,
  ): ProductPositioningTier {
    const price = product.pricing?.sellingPrice;
    const hasPresentation = product.images.length >= 3 && this.isMeaningfulValue(product.category);
    const margin = product.pricing?.grossMarginPercentage ?? 0;

    if (this.isSpecialistProduct(product)) {
      return "specialist";
    }

    if (price === undefined || price <= 0) {
      return "mass-market";
    }

    if (price >= 250 && margin >= 60 && hasPresentation && score.overall >= 85) {
      return "luxury";
    }

    if ((price >= 60 || margin >= 45) && hasPresentation && score.overall >= 65) {
      return "premium";
    }

    if (price <= 20) {
      return "value";
    }

    return "mass-market";
  }

  private buildCorePromise(product: NormalizedProduct, analysis: ProductAIAnalysis): string {
    const benefit = this.coreBenefit(analysis);

    if (benefit.length > 0) {
      return this.sanitizeClaim(`A simpler way to enjoy ${benefit.toLowerCase()}.`);
    }

    return `Reliable everyday convenience with ${this.safeProductType(product).toLowerCase()} positioning.`;
  }

  private buildDifferentiationPoints(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): readonly string[] {
    const points: string[] = [];

    if (product.variants.length > 1) {
      points.push("Multiple variant choices support different customer preferences.");
    }

    if (product.images.length >= 3) {
      points.push("Multiple product images support visual merchandising.");
    }

    if (product.targetMarkets.length >= 3) {
      points.push("Suitable for multiple selected target markets.");
    }

    if (analysis.score.supplierReliability >= 70) {
      points.push("Supplier readiness signals are favorable.");
    }

    if (analysis.keyBenefits.length > 0) {
      points.push(this.normalizeSentence(analysis.keyBenefits[0] ?? ""));
    }

    return this.uniqueValues(points).slice(0, 5);
  }

  private buildMessagingPillars(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): readonly ProductMessagingPillar[] {
    return [
      {
        title: "Outcome",
        message: this.sanitizeClaim(this.corePromiseMessage(product, analysis)),
        supportingPoints: this.supportingPoints([
          this.coreBenefit(analysis),
          product.category,
          analysis.audience.primaryAudience,
        ]),
      },
      {
        title: "Ease",
        message: "A clear product proposition designed for straightforward ecommerce presentation.",
        supportingPoints: this.supportingPoints([
          product.options.length > 0 ? "Clear product options" : "",
          product.variants.length > 1 ? "Multiple variant choices" : "",
          product.images.length > 0 ? "Visual product support" : "",
        ]),
      },
      {
        title: "Trust",
        message: "Positioning stays grounded in available product, supplier, pricing, and risk signals.",
        supportingPoints: this.supportingPoints([
          analysis.risks.level === "low" ? "Low detected risk" : `Risk level: ${analysis.risks.level}`,
          analysis.score.supplierReliability >= 70 ? "Supportive supplier score" : "",
          product.pricing !== undefined ? "Pricing data available" : "",
        ]),
      },
    ];
  }

  private buildNamingDirections(
    product: NormalizedProduct,
    brandedTitle: string,
    tier: ProductPositioningTier,
  ): readonly ProductNamingDirection[] {
    const productType = this.safeProductType(product);
    const compactType = this.compactWords(productType).slice(0, 2).join(" ");

    return [
      {
        direction: "Benefit-led",
        rationale: "Keeps the name focused on the customer outcome rather than supplier wording.",
        exampleNames: [`Everyday ${compactType}`, `Clear ${compactType}`, `Ready ${compactType}`],
      },
      {
        direction: tier === "premium" || tier === "luxury" ? "Premium minimal" : "Functional clarity",
        rationale: "Uses simple commercial language that can scale across product pages and ads.",
        exampleNames: [`The ${compactType}`, `${compactType} Studio`, `${compactType} Select`],
      },
      {
        direction: "Lifestyle-led",
        rationale: `Builds from the current branded title while leaving room for future brand systems.`,
        exampleNames: [`${brandedTitle} Daily`, `${brandedTitle} Co`, `${brandedTitle} Edit`],
      },
    ];
  }

  private buildTaglineOptions(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): readonly string[] {
    const type = this.safeProductType(product).toLowerCase();

    return this.uniqueValues([
      this.sanitizeClaim(`A smarter way to choose your next ${type}.`),
      this.sanitizeClaim("Everyday confidence, clearly presented."),
      this.sanitizeClaim(`Simple ${type} choices for practical routines.`),
      this.sanitizeClaim(this.coreBenefit(analysis)),
    ])
      .filter((tagline) => tagline.length > 0)
      .slice(0, 5);
  }

  private buildApprovedClaims(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): readonly string[] {
    const claims: string[] = [];

    if (product.variants.length > 1) {
      claims.push("Available in multiple variants.");
    }

    if (product.images.length > 1) {
      claims.push("Supported by multiple product images.");
    }

    if (product.options.length > 0) {
      claims.push("Offers clear product options.");
    }

    if (product.targetMarkets.length > 0) {
      claims.push("Suitable for selected target markets.");
    }

    if (analysis.keyBenefits.length > 0) {
      claims.push(this.normalizeSentence(analysis.keyBenefits[0] ?? ""));
    }

    return this.uniqueValues(claims.map((claim) => this.sanitizeClaim(claim))).filter(
      (claim) => claim.length > 0,
    );
  }

  private buildAvoidedClaims(analysis: ProductAIAnalysis): readonly string[] {
    const claims = [
      "Avoid guaranteed results.",
      "Avoid trademark comparisons.",
      "Avoid claiming live popularity or trend status.",
      "Avoid unsupported sustainability claims.",
    ];

    if (analysis.risks.restrictedProductRisk >= 35) {
      claims.push("Avoid medical, treatment, regulated-product, or platform-policy claims.");
    }

    if (analysis.risks.intellectualPropertyRisk >= 35) {
      claims.push("Avoid replica, imitation, or brand-comparison claims.");
    }

    return claims;
  }

  private calculateConfidenceScore(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
  ): number {
    const contentScore = this.contentReadiness(product, analysis);
    return this.clampScore(contentScore * 0.35 + analysis.score.overall * 0.45 + (100 - analysis.risks.score) * 0.2);
  }

  private buildReasoning(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    brandVoice: ProductBrandVoice,
    positioningTier: ProductPositioningTier,
  ): readonly string[] {
    const reasons = [
      `Brand voice is ${brandVoice} based on category, audience, score, and risk signals.`,
      `Positioning tier is ${positioningTier} based on price, margin, presentation, and product score.`,
      analysis.score.overall >= 70
        ? "Product readiness score supports active branding exploration."
        : "Product readiness score suggests cautious branding development.",
      analysis.risks.level === "low"
        ? "Risk level supports a broader commercial messaging range."
        : `Risk level is ${analysis.risks.level}, so claims should remain conservative.`,
      product.images.length > 0
        ? "Available product images support visual brand presentation."
        : "Limited imagery lowers branding confidence.",
      this.isMeaningfulValue(product.brand)
        ? "Existing brand information can support title and positioning."
        : "Branding avoids relying on a weak or missing brand value.",
    ];

    return reasons.slice(0, 6);
  }

  private corePromiseMessage(product: NormalizedProduct, analysis: ProductAIAnalysis): string {
    return `Helps ${this.resolvePrimaryAudience(product, analysis).toLowerCase()} make a clearer product choice.`;
  }

  private coreBenefit(analysis: ProductAIAnalysis): string {
    return this.firstSafeText(analysis.keyBenefits, "clear everyday value");
  }

  private contentReadiness(product: NormalizedProduct, analysis: ProductAIAnalysis): number {
    const checks = [
      this.isMeaningfulValue(product.title),
      product.description.trim().length >= 80,
      product.images.length > 0,
      this.isMeaningfulValue(product.brand),
      this.isMeaningfulValue(product.category),
      analysis.keyBenefits.length > 0,
      analysis.marketingAngles.length > 0,
    ];

    return this.clampScore((checks.filter(Boolean).length / checks.length) * 100);
  }

  private safeProductType(product: NormalizedProduct): string {
    if (this.isMeaningfulValue(product.productType)) {
      return this.normalizeText(product.productType);
    }

    if (this.isMeaningfulValue(product.category)) {
      return this.normalizeText(product.category);
    }

    return "Product";
  }

  private removeTitleClutter(title: string): string {
    return this.normalizeText(title)
      .replace(/\b(free shipping|hot sale|new arrival|dropshipping|wholesale)\b/giu, "")
      .replace(/\b(sku|model)\s*[:#-]?\s*[a-z0-9-]+\b/giu, "")
      .replace(/\b\d+\s*(pcs|pieces|pack)\b/giu, "")
      .replace(/[!]{2,}/gu, "!")
      .replace(/[?]{2,}/gu, "?")
      .replace(/[-_]{2,}/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
  }

  private sanitizeClaim(value: string): string {
    const normalized = this.normalizeSentence(value);
    const lower = normalized.toLowerCase();

    if (UNSAFE_CLAIM_TERMS.some((term) => lower.includes(term))) {
      return "";
    }

    return normalized;
  }

  private normalizeText(value: string | undefined): string {
    return value?.replace(/\s+/gu, " ").trim() ?? "";
  }

  private normalizeSentence(value: string): string {
    const normalized = this.normalizeText(value).replace(/[!]{2,}/gu, "!").replace(/[.]{2,}/gu, ".");
    return normalized.replace(/\s+([,.!?])/gu, "$1");
  }

  private uniqueWords(value: string): readonly string[] {
    const seen = new Set<string>();
    const words: string[] = [];

    for (const word of this.compactWords(value)) {
      const key = word.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        words.push(word);
      }
    }

    return words;
  }

  private compactWords(value: string): readonly string[] {
    return this.normalizeText(value)
      .split(" ")
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  }

  private uniqueValues(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const value of values) {
      const normalized = this.normalizeSentence(value);
      const key = normalized.toLowerCase();

      if (normalized.length > 0 && !seen.has(key)) {
        seen.add(key);
        unique.push(normalized);
      }
    }

    return unique;
  }

  private firstSafeText(values: readonly string[], fallback: string): string {
    return values.map((value) => this.sanitizeClaim(value)).find((value) => value.length > 0) ?? fallback;
  }

  private supportingPoints(values: readonly (string | undefined)[]): readonly string[] {
    const points = values
      .map((value) => (value === undefined ? "" : this.sanitizeClaim(value)))
      .filter((value) => value.length > 0)
      .slice(0, 4);

    return points.length >= 2 ? points : [...points, "Grounded in available product data"].slice(0, 4);
  }

  private searchableText(product: NormalizedProduct, analysis: ProductAIAnalysis): string {
    return [
      product.title,
      product.description,
      product.category,
      product.productType,
      product.brand,
      ...product.tags,
      ...analysis.keyBenefits,
      ...analysis.keyFeatures,
      ...analysis.marketingAngles.map((angle: ProductMarketingAngle) => angle.title),
    ]
      .join(" ")
      .toLowerCase();
  }

  private includesAny(value: string, keywords: readonly string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
  }

  private includesCaseInsensitive(value: string, search: string): boolean {
    return value.toLowerCase().includes(search.toLowerCase());
  }

  private isSpecialistProduct(product: NormalizedProduct): boolean {
    const text = [product.title, product.category, product.productType, ...product.tags].join(" ").toLowerCase();
    return this.includesAny(text, ["professional", "specialist", "tool", "technical", "repair", "equipment"]);
  }

  private isMeaningfulValue(value: string | undefined): value is string {
    if (value === undefined) {
      return false;
    }

    const normalized = this.normalizeText(value).toLowerCase();
    return normalized.length > 0 && !WEAK_PLACEHOLDERS.has(normalized);
  }

  private isWeakValue(value: string): boolean {
    return WEAK_PLACEHOLDERS.has(this.normalizeText(value).toLowerCase());
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
  }
}
